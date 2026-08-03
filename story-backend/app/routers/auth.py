import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from jose import ExpiredSignatureError, JWTError, jwt
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import create_token, get_current_user, hash_password, verify_password
from app.config import settings
from app.database import get_db
from app.models.user import User
from app.models.character import Character
from app.schemas.user import AuthResponse, SSOLoginRequest, UserLogin, UserOut, UserRegister

router = APIRouter(prefix="/auth", tags=["auth"])


def _auth_response(user: User, *, show_onboarding: bool = False) -> AuthResponse:
    return AuthResponse(
        token=create_token(user.id),
        user=UserOut(
            id=user.id,
            username=user.username,
            display_name=user.display_name,
            age_group=user.age_group,
            created_at=user.created_at.isoformat() if user.created_at else None,
        ),
        show_onboarding=show_onboarding,
    )


@router.post("/sso-login", response_model=AuthResponse)
async def sso_login(req: SSOLoginRequest, db: AsyncSession = Depends(get_db)):
    """Exchange a short-lived platform token for the story module's own JWT."""
    if not settings.platform_sso_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="故事模块尚未配置统一登录密钥",
        )
    try:
        payload = jwt.decode(
            req.sso_token,
            settings.platform_sso_secret,
            algorithms=[settings.platform_sso_algorithm],
        )
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="统一登录凭证已过期，请重新登录",
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="统一登录凭证无效",
        )

    platform_uid = str(payload.get("platformUid") or "").strip()
    platform_name = str(payload.get("username") or "").strip()
    if not platform_uid or len(platform_uid) > 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="统一登录凭证缺少有效学号",
        )

    result = await db.execute(select(User).where(User.platform_uid == platform_uid))
    user = result.scalar_one_or_none()
    show_onboarding = False

    if user is None:
        # Do not link by username: identical display names must never inherit
        # another child's stories. platform_uid is the only SSO identity key.
        internal_username = f"sso_{platform_uid}"[:50]
        collision = await db.execute(select(User.id).where(User.username == internal_username))
        if collision.scalar_one_or_none() is not None:
            internal_username = f"sso_{platform_uid}_{secrets.token_hex(4)}"[:50]
        user = User(
            username=internal_username,
            platform_uid=platform_uid,
            password_hash=hash_password(secrets.token_urlsafe(32)),
            display_name=platform_name or platform_uid,
            has_seen_onboarding=True,
        )
        db.add(user)
        try:
            await db.commit()
            await db.refresh(user)
            show_onboarding = True
        except IntegrityError:
            # Another request for the same first-time SSO user may win the
            # insert race (for example React StrictMode in development).
            # Roll back this transaction and reuse the row it created.
            await db.rollback()
            result = await db.execute(
                select(User).where(User.platform_uid == platform_uid)
            )
            user = result.scalar_one_or_none()
            if user is None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="统一登录账号创建冲突，请重试",
                )
    elif platform_name and (not user.display_name or user.display_name == user.username):
        user.display_name = platform_name
        await db.commit()
        await db.refresh(user)

    return _auth_response(user, show_onboarding=show_onboarding)


@router.post("/register", response_model=AuthResponse)
async def register(req: UserRegister, db: AsyncSession = Depends(get_db)):
    # Check if username exists
    existing = await db.execute(select(User).where(User.username == req.username))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="这个用户名已经被使用啦，换一个吧！",
        )

    user = User(
        username=req.username,
        password_hash=hash_password(req.password),
        display_name=req.display_name or req.username,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # The guide belongs to the first authenticated session only.
    user.has_seen_onboarding = True
    await db.commit()

    token = create_token(user.id)
    return AuthResponse(
        token=token,
        user=UserOut(
            id=user.id,
            username=user.username,
            display_name=user.display_name,
            age_group=user.age_group,
            created_at=user.created_at.isoformat() if user.created_at else None,
        ),
        show_onboarding=True,
    )


@router.post("/login", response_model=AuthResponse)
async def login(req: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == req.username))
    user = result.scalar_one_or_none()

    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码不对哦，再试试吧！",
        )

    token = create_token(user.id)
    show_onboarding = not user.has_seen_onboarding
    if show_onboarding:
        user.has_seen_onboarding = True
        await db.commit()
    return AuthResponse(
        token=token,
        user=UserOut(
            id=user.id,
            username=user.username,
            display_name=user.display_name,
            age_group=user.age_group,
            created_at=user.created_at.isoformat() if user.created_at else None,
        ),
        show_onboarding=show_onboarding,
    )


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserOut(
        id=current_user.id,
        username=current_user.username,
        display_name=current_user.display_name,
        age_group=current_user.age_group,
        created_at=current_user.created_at.isoformat() if current_user.created_at else None,
    )


@router.patch("/me/channel")
async def update_channel(
    age_group: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update user's age group channel."""
    if age_group not in ("4-7", "8-12"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="无效的年龄段")
    current_user.age_group = age_group
    await db.execute(
        update(Character)
        .where(Character.user_id == current_user.id)
        .values(age_group=age_group)
    )
    await db.commit()
    return {"age_group": age_group}
