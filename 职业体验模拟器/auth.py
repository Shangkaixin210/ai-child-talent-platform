"""
Authentication module — password hashing, token management, FastAPI dependencies.
Uses only Python stdlib (hashlib.pbkdf2_hmac + os.urandom) — no extra deps.
"""
from __future__ import annotations

import os
import hashlib
import secrets
import uuid
import base64
import hmac
import json
import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import Request, HTTPException, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import User, AuthToken, Session
from config import PLATFORM_SSO_SECRET


# ---- Password hashing (pbkdf2_hmac, stdlib only) ----

def hash_password(password: str) -> tuple[str, str]:
    """Hash a password with a random salt. Returns (hex_hash, hex_salt)."""
    salt = os.urandom(32)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000, dklen=64)
    return key.hex(), salt.hex()


def verify_password(password: str, salt_hex: str, stored_hash: str) -> bool:
    """Check a password against the stored hash and salt."""
    try:
        salt = bytes.fromhex(salt_hex)
        key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000, dklen=64)
        return secrets.compare_digest(key.hex(), stored_hash)
    except (ValueError, TypeError):
        return False


# ---- Token management ----

def generate_auth_token() -> str:
    """Generate a cryptographically random auth token (64 hex chars)."""
    return secrets.token_hex(32)


# ---- User CRUD ----

async def create_user(
    db: AsyncSession,
    username: str,
    password: str,
    display_name: str,
    age: int,
) -> User:
    """Create a new user account. Raises ValueError if username is taken."""
    username = username.strip().lower()
    if not (3 <= len(username) <= 20):
        raise ValueError("用户名需要3–20个字符")
    if len(password) < 4:
        raise ValueError("密码至少需要4个字符")

    existing = await db.execute(select(User).where(User.username == username))
    if existing.scalar_one_or_none():
        raise ValueError("这个用户名已经被注册了，换一个试试？")

    key_hex, salt_hex = hash_password(password)
    user = User(
        id=str(uuid.uuid4()),
        username=username,
        password_hash=key_hex,
        salt=salt_hex,
        display_name=display_name.strip()[:50] or username,
        age=age,
    )
    db.add(user)
    await db.flush()
    return user


# ---- Platform SSO ----

def _base64url_decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def verify_platform_sso_token(sso_token: str) -> dict:
    """Verify the total-platform HS256 JWT without adding a new Python dependency."""
    if not PLATFORM_SSO_SECRET:
        raise ValueError("职业体验尚未配置统一登录密钥")
    try:
        header_b64, payload_b64, signature_b64 = sso_token.split(".")
        header = json.loads(_base64url_decode(header_b64).decode("utf-8"))
        payload = json.loads(_base64url_decode(payload_b64).decode("utf-8"))
        if header.get("alg") != "HS256":
            raise ValueError("不支持的登录凭证算法")
        signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
        expected = hmac.new(PLATFORM_SSO_SECRET.encode("utf-8"), signing_input, hashlib.sha256).digest()
        actual = _base64url_decode(signature_b64)
        if not hmac.compare_digest(expected, actual):
            raise ValueError("登录凭证签名无效")
        expires_at = payload.get("exp")
        if not isinstance(expires_at, (int, float)) or datetime.now(timezone.utc).timestamp() >= expires_at:
            raise ValueError("登录凭证已过期")
        if not str(payload.get("platformUid", "")).strip():
            raise ValueError("登录凭证缺少平台用户标识")
        return payload
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError("登录凭证无效") from exc


async def get_user_by_platform_uid(db: AsyncSession, platform_uid: str) -> User | None:
    result = await db.execute(select(User).where(User.platform_uid == platform_uid))
    return result.scalar_one_or_none()


async def create_sso_user(
    db: AsyncSession,
    platform_uid: str,
    display_name: str,
) -> User:
    """Create the minimal local profile needed to bind career records to a platform user."""
    clean_uid = platform_uid.strip()
    base_username = "sso_" + re.sub(r"[^a-zA-Z0-9_]", "", clean_uid.lower())[:15]
    username = base_username or "sso_user"
    suffix = 1
    while (await db.execute(select(User).where(User.username == username))).scalar_one_or_none():
        suffix += 1
        username = f"{base_username[:16]}_{suffix}"

    password_hash, salt = hash_password(secrets.token_urlsafe(32))
    user = User(
        id=str(uuid.uuid4()),
        username=username,
        password_hash=password_hash,
        salt=salt,
        display_name=(display_name or clean_uid)[:50],
        # 总平台当前不保存年龄；第一次开启职业情境时由学生选择并写回职业档案。
        age=10,
        platform_uid=clean_uid,
    )
    db.add(user)
    await db.flush()
    return user


async def authenticate_user(db: AsyncSession, username: str, password: str) -> tuple[User, str] | None:
    """Verify credentials and create an auth token. Returns (user, token) or None."""
    username = username.strip().lower()
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user:
        return None
    if not verify_password(password, user.salt, user.password_hash):
        return None

    token_str = generate_auth_token()
    db.add(AuthToken(id=str(uuid.uuid4()), user_id=user.id, token=token_str))
    await db.flush()
    return user, token_str


async def get_user_by_token(db: AsyncSession, token: str) -> User | None:
    """Look up a user by their auth token. Returns None if invalid/expired."""
    token = token.strip()
    if len(token) < 32:
        return None
    result = await db.execute(
        select(User)
        .join(AuthToken, AuthToken.user_id == User.id)
        .where(AuthToken.token == token)
    )
    return result.scalar_one_or_none()


async def invalidate_token(db: AsyncSession, token: str) -> None:
    """Delete an auth token (logout)."""
    token = token.strip()
    result = await db.execute(select(AuthToken).where(AuthToken.token == token))
    row = result.scalar_one_or_none()
    if row:
        await db.delete(row)
        await db.flush()


# ---- FastAPI dependencies ----

# Will be set after app and async_session are created (in main.py)
_db_sessionmaker = None


def set_db_sessionmaker(sessionmaker):
    global _db_sessionmaker
    _db_sessionmaker = sessionmaker


async def get_db() -> AsyncSession:
    """Yield a database session. Used by FastAPI dependency injection."""
    if _db_sessionmaker is None:
        raise RuntimeError("DB sessionmaker not initialized — call set_db_sessionmaker()")
    async with _db_sessionmaker() as db:
        yield db


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    """FastAPI dependency — extracts and validates the Bearer token.
    Raises 401 if the token is missing or invalid.
    """
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="请先登录")
    token = auth.removeprefix("Bearer ").strip()
    user = await get_user_by_token(db, token)
    if not user:
        raise HTTPException(status_code=401, detail="登录已过期，请重新登录")
    return user


async def get_current_user_optional(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Like get_current_user but returns None instead of raising 401."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth.removeprefix("Bearer ").strip()
    return await get_user_by_token(db, token)


# ---- Claim old sessions ----

async def claim_old_sessions(db: AsyncSession, user: User) -> int:
    """Associate completed sessions (user_id IS NULL) with this user account.
    Matches by display_name and by existing student_token patterns.
    Returns the number of sessions claimed.
    """
    # 姓名并不是可靠身份凭据。为了避免把同名学生的体验记录错认领到
    # 当前账号，历史匿名数据不再自动迁移；之后可由教师后台走人工确认流程。
    return 0

    count = 0

    # Strategy 1: match by display_name
    result = await db.execute(
        select(Session).where(
            Session.student_name == user.display_name,
            Session.user_id == None,
            Session.status == "completed",
        )
    )
    for s in result.scalars().all():
        s.user_id = user.id
        count += 1

    # Strategy 2: also match by username as student_name
    if user.username != user.display_name:
        result = await db.execute(
            select(Session).where(
                Session.student_name == user.username,
                Session.user_id == None,
                Session.status == "completed",
            )
        )
        for s in result.scalars().all():
            if s.user_id is None:
                s.user_id = user.id
                count += 1

    await db.flush()
    return count
