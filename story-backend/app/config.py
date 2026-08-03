from pathlib import Path

from pydantic_settings import BaseSettings


BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    # Database
    database_url: str = f"sqlite+aiosqlite:///{(PROJECT_DIR / 'story_cocreate.db').as_posix()}"

    # LLM (DeepSeek)
    llm_api_key: str = ""
    llm_base_url: str = "https://api.deepseek.com/v1"
    llm_model: str = "deepseek-chat"

    # Free Microsoft Edge online TTS
    edge_tts_voice: str = "zh-CN-XiaoxiaoNeural"
    edge_tts_rate: str = "-8%"
    edge_tts_pitch: str = "+3Hz"

    # JWT
    jwt_secret_key: str = "story-cocreate-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 days

    # SSO token verification. This is deliberately separate from jwt_secret_key:
    # the platform token proves identity, then this service issues its own token.
    # Keep local clones compatible with the platform-auth development fallback.
    # Production deployments must override this value through the environment.
    platform_sso_secret: str = "platform-sso-demo-secret-do-not-use-in-production"
    platform_sso_algorithm: str = "HS256"

    # Story config
    max_turns: int = 15  # Soft safety cap; AI decides ending dynamically

    # App
    debug: bool = True

    # Resolve the env file from the source tree, not the process working directory.
    model_config = {"env_file": str(BACKEND_DIR / ".env"), "env_file_encoding": "utf-8"}


settings = Settings()
