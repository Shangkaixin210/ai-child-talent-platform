import asyncio
import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.models.character import Character
from app.models.message import StoryMessage
from app.models.story import Story
from app.models.user import User
from app.schemas.message import StoryMessageOut
from app.schemas.story import StoryCreate, StoryOut, StoryUpdate, TurnRequest
from app.services import observation_service, story_service
from app.services.content_guard import (
    EMPTY_AFTER_CLEAN_MESSAGE,
    INPUT_BLOCK_MESSAGE,
    PARENT_REMINDER,
    check_engagement,
    clean_submitted_text,
    contains_prohibited_content,
    guard_child_input,
    redact_privacy,
    sanitize_agent_output,
)
from app.services.llm_service import LLMServiceError, get_llm_service

router = APIRouter(prefix="/stories", tags=["stories"])


@router.get("", response_model=list[StoryOut])
async def list_stories(
    character_id: int | None = None,
    status: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Story).join(Character).where(
        Character.user_id == current_user.id,
        Story.is_deleted == False,
    )
    if character_id:
        query = query.where(Story.character_id == character_id)
    if status:
        query = query.where(Story.status == status)
    query = query.order_by(Story.updated_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=StoryOut, status_code=status.HTTP_201_CREATED)
async def create_story(
    req: StoryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify character belongs to user
    char = await db.get(Character, req.character_id)
    if not char or char.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="角色不存在")

    title_guard = guard_child_input(req.title or "")
    theme_guard = guard_child_input(req.theme or "")
    if title_guard.blocked or theme_guard.blocked:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(title_guard.message or theme_guard.message),
        )
    title = title_guard.sanitized_text or None
    theme = theme_guard.sanitized_text or None
    if title:
        duplicate = await db.execute(
            select(Story.id)
            .join(Character)
            .where(
                Character.user_id == current_user.id,
                func.lower(Story.title) == title.lower(),
            )
        )
        if duplicate.first() is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="故事名字已经存在，请换一个名字")

    story = Story(
        character_id=req.character_id,
        theme=theme,
        title=title,
    )
    db.add(story)
    await db.commit()
    await db.refresh(story)
    return story


@router.get("/{story_id}", response_model=StoryOut)
async def get_story(
    story_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    story = await _get_user_story(story_id, current_user, db)
    return story


@router.patch("/{story_id}", response_model=StoryOut)
async def update_story(
    story_id: int,
    req: StoryUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    story = await _get_user_story(story_id, current_user, db)
    if req.title is not None:
        title_guard = guard_child_input(req.title)
        if title_guard.blocked:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=title_guard.message,
            )
        title = title_guard.sanitized_text
        if title:
            duplicate = await db.execute(
                select(Story.id)
                .join(Character)
                .where(
                    Character.user_id == current_user.id,
                    Story.id != story_id,
                    func.lower(Story.title) == title.lower(),
                )
            )
            if duplicate.first() is not None:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="故事名字已经存在，请换一个名字")
        story.title = title or None
    if req.status is not None:
        story.status = req.status
        if req.status == "completed":
            story.completed_at = datetime.utcnow()
    await db.commit()
    await db.refresh(story)
    return story


@router.delete("/{story_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_story(
    story_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete: marks story as deleted but preserves data for parent/teacher review."""
    story = await _get_user_story(story_id, current_user, db)
    story.is_deleted = True
    await db.commit()


@router.get("/parent/all", response_model=list[StoryOut])
async def list_all_stories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Parent/teacher view: shows ALL stories including deleted ones."""
    query = (
        select(Story)
        .join(Character)
        .where(Character.user_id == current_user.id)
        .order_by(Story.updated_at.desc())
    )
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{story_id}/messages", response_model=list[StoryMessageOut])
async def get_story_messages(
    story_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_user_story(story_id, current_user, db)
    result = await db.execute(
        select(StoryMessage)
        .where(StoryMessage.story_id == story_id)
        .order_by(StoryMessage.turn_number, StoryMessage.id)
    )
    safe_messages = []
    for message in result.scalars().all():
        if message.role == "child" and contains_prohibited_content(message.content):
            continue
        content = (
            redact_privacy(message.content)[0]
            if message.role == "child"
            else sanitize_agent_output(message.content)
        )
        safe_messages.append({
            "id": message.id,
            "story_id": message.story_id,
            "turn_number": message.turn_number,
            "role": message.role,
            "content": content,
            "ai_raw_response": (
                sanitize_agent_output(message.ai_raw_response)
                if message.ai_raw_response else None
            ),
            "created_at": message.created_at,
        })
    return safe_messages


@router.post("/{story_id}/turn")
async def story_turn(
    story_id: int,
    req: TurnRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """The core endpoint: process a child's input and stream back the AI response."""
    story = await _get_user_story(story_id, current_user, db)

    if story.status != "active":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="这个故事已经结束啦！")

    is_first_turn = (story.turn_count == 0)

    # A forced ending is a command to the director, not a child contribution.
    # It must be allowed to carry an empty child_input; otherwise the frontend's
    # "让故事导演写结局" action is rejected before it reaches the director.
    if not is_first_turn and not req.force_ending and not req.child_input.strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="写下你的想法吧！")

    safe_child_input = req.child_input
    clean_result = None
    if not is_first_turn and not req.force_ending:
        clean_result = clean_submitted_text(req.child_input)
        if not clean_result.cleaned_text:
            story.safety_violation_count = (story.safety_violation_count or 0) + 1
            await db.commit()
            message = (
                PARENT_REMINDER
                if story.safety_violation_count >= 3
                else EMPTY_AFTER_CLEAN_MESSAGE
            )

            async def blocked_event_generator():
                yield (
                    "event: safety_notice\ndata: "
                    + json.dumps({
                        "message": message,
                        "level": "heavy" if story.safety_violation_count >= 3 else "moderate",
                    }, ensure_ascii=False)
                    + "\n\n"
                )
                yield "event: input_blocked\ndata: {}\n\n"
                yield (
                    "event: done\ndata: "
                    + json.dumps({
                        "turn_number": story.turn_count,
                        "is_ending": False,
                        "blocked": True,
                    }, ensure_ascii=False)
                    + "\n\n"
                )

            return StreamingResponse(
                blocked_event_generator(),
                media_type="text/event-stream",
                headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
            )
        safe_child_input = clean_result.cleaned_text
        story.safety_violation_count = 0

    turn_number = story.turn_count + 1

    # Get character info for prompt (eager load, not via lazy relationship)
    char = await db.get(Character, story.character_id)

    # 1. Save child message (skip for first turn — AI initiates)
    child_msg = None
    if not is_first_turn and not req.force_ending:
        child_msg = await story_service.save_child_message(
            db, story_id, turn_number, safe_child_input
        )

    # 2. Build message history
    messages = await story_service.get_story_messages(db, story_id)
    # Frozen context for the evaluator. It may inspect continuity, but only the
    # separately supplied child_input is allowed to contribute score evidence.
    evaluation_context = "\n".join(
        f"{'孩子' if item.get('role') == 'user' else '故事导演'}：{item.get('content', '')}"
        for item in messages[-12:]
    )
    # 3. Engagement check on the already-sanitized input.
    engagement_hint = ""
    if safe_child_input and safe_child_input.strip():
        engagement = check_engagement(safe_child_input)
        if engagement.issue_type != "OK":
            engagement_hint = engagement.prompt_hint

    if not is_first_turn:
        content = safe_child_input
        if engagement_hint:
            content = f"{safe_child_input}\n\n[系统提示：{engagement_hint}]"
        messages.append({"role": "user", "content": content})
    else:
        # First turn: add a system-level trigger for the AI to start
        messages.append({"role": "user", "content": "请开始我们的故事吧！"})
    # 4. LLM service with character + personality context
    llm = get_llm_service()

    async def event_generator():
        narrative_parts = []
        question_text = ""
        observation_data = None
        praise_text = ""
        ai_ending = False
        image_urls: list[str] = []  # Collect for storage

        if clean_result and clean_result.removed_count > 0:
            yield f"event: input_redacted\ndata: {json.dumps({'text': safe_child_input}, ensure_ascii=False)}\n\n"
            yield f"event: safety_notice\ndata: {json.dumps({'message': INPUT_BLOCK_MESSAGE, 'level': 'mild'}, ensure_ascii=False)}\n\n"

        try:
            # Story Fairy and Talent Evaluator analyze the child's contribution
            # together. Persist the observation before the director starts so
            # evidence survives director/network failures and early page exits.
            if child_msg and safe_child_input.strip():
                age = current_user.age_group or "8-12"
                praise_result, evaluation_result = await asyncio.gather(
                    llm.generate_praise(safe_child_input, evaluation_context, age),
                    llm.evaluate_turn(safe_child_input, age, evaluation_context),
                    return_exceptions=True,
                )
                praise_text = (
                    sanitize_agent_output(praise_result)
                    if isinstance(praise_result, str) else ""
                )
                if isinstance(evaluation_result, Exception):
                    from app.services.llm_service import (
                        compute_observation,
                        upgrade_observation,
                    )
                    observation_data = upgrade_observation(
                        compute_observation(safe_child_input, age)
                    )
                else:
                    observation_data = evaluation_result
                if observation_data:
                    await observation_service.save_observation(
                        db, story_id, child_msg.id, turn_number, observation_data,
                    )
                if praise_text:
                    yield f"event: praise\ndata: {json.dumps({'text': praise_text, 'agent': '故事精灵'}, ensure_ascii=False)}\n\n"

            async for chunk in llm.generate_turn(
                messages,
                character_name=sanitize_agent_output(char.nickname) if char else "",
                character_type=char.avatar_type if char else "",
                personality=sanitize_agent_output(char.personality or "") if char else "",
                theme=sanitize_agent_output(story.theme or ""),
                is_first_turn=is_first_turn,
                age_group=current_user.age_group or "8-12",
            ):
                if chunk["type"] == "narrative_chunk":
                    safe_text = sanitize_agent_output(chunk["text"])
                    narrative_parts.append(safe_text)
                    data = {"text": safe_text}
                    # If LLM provided an image_prompt, use it; otherwise generate from text
                    img_prompt = sanitize_agent_output(chunk.get("image_prompt", ""))
                    if not img_prompt and len(safe_text) > 20:
                        from app.services.image_service import generate_image_prompt_from_narrative, generate_image_url
                        img_prompt = generate_image_prompt_from_narrative(safe_text)
                    if img_prompt:
                        from app.services.image_service import generate_image_url
                        img_url = generate_image_url(img_prompt)
                        data["image_url"] = img_url
                        image_urls.append(img_url)
                    yield f"event: narrative_chunk\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

                elif chunk["type"] == "ending":
                    ai_ending = True
                    safe_text = sanitize_agent_output(chunk["text"])
                    narrative_parts.append(safe_text)
                    data = {"text": safe_text}
                    from app.services.image_service import generate_image_prompt_from_narrative, generate_image_url
                    img_prompt = generate_image_prompt_from_narrative(safe_text)
                    ending_image_url = generate_image_url(img_prompt)
                    data["image_url"] = ending_image_url
                    image_urls.append(ending_image_url)
                    yield f"event: ending\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

                elif chunk["type"] == "question":
                    question_text = sanitize_agent_output(chunk["text"])
                    yield f"event: question\ndata: {json.dumps({'text': question_text}, ensure_ascii=False)}\n\n"

                elif chunk["type"] == "observation":
                    observation_data = chunk["data"]
                    # Silently save — not sent to frontend

                elif chunk["type"] == "heartbeat":
                    yield f": heartbeat\n\n"

                elif chunk["type"] == "done":
                    narrative = "".join(narrative_parts)

                    # Always keep at least one illustration for a non-empty AI turn.
                    # The URL is emitted to the live view and persisted for refresh/gallery.
                    if narrative and not image_urls:
                        from app.services.image_service import generate_image_prompt_from_narrative, generate_image_url
                        fallback_prompt = generate_image_prompt_from_narrative(narrative)
                        fallback_image_url = generate_image_url(fallback_prompt)
                        if fallback_image_url:
                            image_urls.append(fallback_image_url)
                            yield f"event: illustration\ndata: {json.dumps({'image_url': fallback_image_url}, ensure_ascii=False)}\n\n"

                    # 4. Save AI message
                    ai_msg = await story_service.save_ai_message(
                        db, story_id, turn_number, narrative, question_text,
                        json.dumps({
                            "narrative": narrative,
                            "question": question_text,
                            "observation": observation_data,
                            "praise": praise_text,
                            "image_urls": image_urls,
                        }, ensure_ascii=False),
                    )

                    # 5. Update turn count (use explicit UPDATE to avoid ORM tracking issues)
                    await db.execute(
                        update(Story).where(Story.id == story_id).values(turn_count=turn_number)
                    )

                    # 7. Check if story should end: AI decides, soft cap at max_turns
                    is_ending = req.force_ending or ai_ending or (turn_number >= settings.max_turns)
                    if is_ending:
                        await db.execute(
                            update(Story).where(Story.id == story_id).values(
                                status="completed",
                                completed_at=datetime.utcnow(),
                            )
                        )
                        # Build full_text
                        result = await db.execute(
                            select(StoryMessage)
                            .where(StoryMessage.story_id == story_id)
                            .order_by(StoryMessage.turn_number, StoryMessage.id)
                        )
                        all_msgs = result.scalars().all()
                        parts = []
                        for msg in all_msgs:
                            role_label = "【AI故事导演】" if msg.role == "ai" else "【小作家】"
                            parts.append(f"{role_label}\n{msg.content}")
                        await db.execute(
                            update(Story).where(Story.id == story_id).values(
                                full_text="\n\n".join(parts)
                            )
                        )

                    await db.commit()

                    yield f"event: done\ndata: {json.dumps({'message_id': ai_msg.id, 'turn_number': turn_number, 'is_ending': is_ending}, ensure_ascii=False)}\n\n"
                    return

        except LLMServiceError as e:
            yield f"event: error\ndata: {json.dumps({'message': f'故事导演去休息了，稍等一下哦~ {str(e)}'}, ensure_ascii=False)}\n\n"
        except Exception as e:
            import traceback
            traceback.print_exc()
            yield f"event: error\ndata: {json.dumps({'message': f'服务器出了点小问题: {str(e)[:200]}'}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


async def _get_user_story(story_id: int, user: User, db: AsyncSession) -> Story:
    story = await db.get(Story, story_id)
    if not story:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="故事不存在")

    # Verify story belongs to user
    char = await db.get(Character, story.character_id)
    if not char or char.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="故事不存在")

    return story
