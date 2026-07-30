import importlib.util
import sys
import traceback
from pathlib import Path

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.database import init_db
from app.routers import auth, characters, dictionary, observations, stories, talents, tts


# 职业体验模块原本是独立的 FastAPI 应用。这里把它作为总后端的子应用加载，
# 这样启动 story-backend 的 8000 端口时，职业体验也会一同可用。
PROJECT_ROOT = Path(__file__).resolve().parents[2]
CAREER_MODULE_DIR = PROJECT_ROOT / "职业体验模拟器"


def load_career_application():
    if not CAREER_MODULE_DIR.exists():
        raise RuntimeError(f"未找到职业体验模块目录：{CAREER_MODULE_DIR}")
    career_dir = str(CAREER_MODULE_DIR)
    if career_dir not in sys.path:
        sys.path.insert(0, career_dir)
    spec = importlib.util.spec_from_file_location(
        "career_simulator_app", CAREER_MODULE_DIR / "main.py"
    )
    if spec is None or spec.loader is None:
        raise RuntimeError("职业体验模块加载配置失败")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


career_module = load_career_application()
career_app = career_module.app


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await career_module.init_db()
    yield


app = FastAPI(
    title="AI 伯乐 - 故事共创",
    description="与孩子共同创作故事，发现语言天赋",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 开发阶段允许所有来源访问
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Global exception handlers ──
# These ensure ALL errors return JSON instead of plain text "Internal Server Error"

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": f"服务器出了点小问题: {str(exc)[:200]}"},
    )


@app.exception_handler(500)
async def internal_error_handler(request: Request, exc: Exception):
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": "服务器内部错误，请稍后重试"},
    )


# Routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(characters.router, prefix="/api/v1")
app.include_router(stories.router, prefix="/api/v1")
app.include_router(observations.router, prefix="/api/v1")
app.include_router(talents.router, prefix="/api/v1")
app.include_router(dictionary.router, prefix="/api/v1")
app.include_router(tts.router, prefix="/api/v1")


@app.get("/api/health")
async def platform_health():
    return {"status": "ok", "message": "platform backend ready"}


# This catch-all mount is deliberately registered after the platform API routes.
# The career app keeps its existing pages, /api endpoints and /static assets,
# while the existing story routes continue to own /api/v1.
app.mount("/", career_app, name="career-simulator")


@app.get("/api/health")
async def health():
    return {"status": "ok", "message": "故事导演已就绪！"}
