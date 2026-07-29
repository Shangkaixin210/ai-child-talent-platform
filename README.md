# AI 儿童天赋平台

Vite + React + TypeScript 总平台，故事共创模块已接入 `/story-create`。

## 启动总前端

```powershell
npm install
npm run dev
```

前端默认地址：`http://localhost:5173`

## 启动故事共创后端

首次启动：

```powershell
cd story-backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

按需填写 `.env` 中的模型密钥，然后启动：

```powershell
python -m uvicorn app.main:app --reload --port 8000
```

开发环境中，Vite 会把 `/api` 请求代理到 `http://localhost:8000`。

## 故事模块路由

- `/story-create`：故事首页
- `/story-create/login`：故事登录
- `/story-create/channel`：年龄通道
- `/story-create/characters`：角色创建
- `/story-create/play/:storyId`：故事共创
- `/story-create/gallery`：故事书架
- `/story-create/talent/:storyId`：故事天赋报告
