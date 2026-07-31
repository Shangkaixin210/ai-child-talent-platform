# AI 儿童天赋平台

总平台采用 Vite + React + TypeScript。故事共创与职业体验是两个可独立启动、独立部署的 Python/FastAPI 服务。

## 服务结构

| 服务 | 本地地址 | 生产环境变量 |
| --- | --- | --- |
| 总平台前端 | `http://localhost:5173` | — |
| 故事共创后端 | `http://localhost:8000` | `VITE_STORY_API_URL` |
| 职业体验服务 | `http://localhost:8001` | `VITE_CAREER_SIM_URL` |

正式部署时三个服务不必位于同一台电脑或同一台服务器，只要各自拥有可访问的 HTTPS 地址。

## 本地启动

### 1. 总平台前端

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

本地环境可保持两个地址为空：故事请求由 Vite 代理到 `8000`，职业模块默认连接 `8001`。

### 2. 故事共创后端

```powershell
cd story-backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. 职业体验服务

```powershell
cd 职业体验模拟器
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

## 独立部署

仓库根目录的 `render.yaml` 定义两个独立 Render Web Service。前端可部署到 Vercel，并配置：

```env
VITE_STORY_API_URL=https://你的故事后端域名
VITE_CAREER_SIM_URL=https://你的职业服务域名
```

两个后端的 `CORS_ORIGINS` 应填写总平台前端域名，多个域名用英文逗号分隔。

## 安全说明

- `.env`、数据库和 API 密钥不得提交到 Git。
- 生产环境不要把 `CORS_ORIGINS` 设置为 `*`。
- SQLite 适合本地开发；多人正式使用时应配置持久化磁盘或迁移到 PostgreSQL。
- `JWT_SECRET_KEY` 和 `TEACHER_REVIEW_KEY` 在生产环境必须使用随机保密值。
