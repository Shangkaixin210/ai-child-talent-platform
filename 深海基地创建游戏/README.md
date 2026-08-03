# 深海基地创建游戏

该目录是总平台 `/campus-design` 模块的完整源码，不再作为 Git 子模块维护。

## 首次安装

```powershell
npm install
python -m venv server/.venv
server/.venv/Scripts/python.exe -m pip install -r server/requirements.txt
Copy-Item server/.env.example server/.env
```

编辑 `server/.env`，至少配置：

```text
SSO_SECRET_KEY=与总平台 platform-auth 使用的 PLATFORM_SSO_SECRET 相同的值
```

`DEEPSEEK_API_KEY` 可选；未配置时智能体使用降级逻辑。

## 开发启动

需要同时运行两个后端服务：

```powershell
# 行为评分服务，端口 3000
npm --prefix server start

# SSO、智能体、TTS 和报告服务，端口 8005
server/.venv/Scripts/python.exe server/server.py
```

总平台的 Vite 服务会将 `/api/assessment/submit-level` 转发至 `3000`，并将其余 `/api/assessment` 请求转发至 `8005`。

## 健康检查

```powershell
Invoke-WebRequest http://localhost:3000/api/health -UseBasicParsing
Invoke-WebRequest http://localhost:8005/docs -UseBasicParsing
```

登录后若页面显示 `HTTP 502`，优先确认 `8005` 服务已经启动；若返回 `401`，确认两端 SSO 密钥完全一致并重新登录获取新令牌。
