# SSO 统一登录接入现状报告

> **生成日期**：2026-08-01
> **目的**：供外部技术顾问审查，仅客观陈述现状，不做主观结论性评价。
> **涉及项目**：
> - **总平台** `ai-child-talent-platform`（Vite + React 前端，Express 登录后端）
> - **聊天模块** `AI-talent scout`（Express 全栈，含 HTML 前端）

---

## 一、架构现状

### 1.1 服务拓扑

```
┌──────────────────────────────────────────────────────────────────┐
│                         浏览器 (Browser)                          │
│                                                                   │
│  ① 打开 /platform-login         ⑥ 打开 /chat-observe?sso_token=xxx │
│  ② 提交学号+密码                 ⑦ iframe 加载 home.html?sso_token   │
│  ④ 拿到 JWT → /login?sso_token  ⑧ home.html POST /api/auth/sso-login│
│  ⑤ 点击模块卡片（带 sso_token）                                   │
└──────────────────────────────────────────────────────────────────┘
        │                │                      │
        ▼                ▼                      ▼
┌───────────────┐ ┌──────────────┐  ┌──────────────────────────────┐
│ Vite Dev Server│ │platform-auth │  │  AI-talent scout (Express)   │
│    :5173       │ │   :4000      │  │       :3000                  │
│                │ │              │  │                              │
│ proxy:         │ │ POST /api/   │  │ POST /api/auth/sso-login     │
│ /api/platform  │ │ platform/    │  │  → 验证 JWT                  │
│ → :4000        │ │ register     │  │  → 按 platformUid 查找/创建   │
│                │ │ login        │  │  → 写 session + Set-Cookie   │
│ /api → :8000   │ │ check-login  │  │                              │
│                │ │ logout       │  │                              │
└───────────────┘ └──────────────┘  └──────────────────────────────┘
```

### 1.2 完整登录链路（按步骤）

**首次登录流程：**

| 步骤 | 用户/系统动作 | 涉及的接口/文件 | 说明 |
|------|--------------|----------------|------|
| 1 | 用户访问 `http://localhost:5173/platform-login` | [App.tsx:18](src/App.tsx#L18) 路由分发 → [PlatformLogin/index.tsx](src/pages/PlatformLogin/index.tsx) | 先调用 `GET /api/platform/check-login` 检查长期 Cookie，无效则展示学号 + 密码表单 |
| 2 | 用户提交学号 + 密码 | `POST /api/platform/login` | Vite proxy 转发至 `localhost:4000` |
| 3 | platform-auth 验证凭据 | [platform-auth/server.js:150-189](platform-auth/server.js#L150-L189) | bcrypt 比对密码，签发临时 sso_token（HS256，30 分钟）+ 长期 Cookie `platform_login`（30 天） |
| 4 | 返回 JWT + Set-Cookie，前端跳转 | [PlatformLogin/index.tsx:68](src/pages/PlatformLogin/index.tsx#L68) | `navigate('/login?sso_token=JWT')` |
| 5 | 模块选择页展示 4 张卡片 + 个人中心 | [Login/index.tsx:71-158](src/pages/Login/index.tsx#L71-L158) | 从 URL 读取 `sso_token` 并解码显示用户信息，调用 `/check-login` 验证长期 Cookie。未登录时卡片链接指向 `/platform-login` |
| 6 | 用户点击"自然聊天观察" | [Login/index.tsx:147-148](src/pages/Login/index.tsx#L147-L148) | 跳转 `/chat-observe?sso_token=JWT`（未登录则跳转 `/platform-login`） |
| 7 | ChatObserve 页面渲染 iframe | [ChatObserve/index.tsx:15-17](src/pages/ChatObserve/index.tsx#L15-L17) | iframe src 指向 `localhost:3000/home.html?sso_token=JWT`（无 token 时回退到 ngrok 地址） |
| 8 | home.html 检测 sso_token | `AI-talent scout/public/home.html:589-633` | 前端 JS 调用 `POST /api/auth/sso-login` |
| 9 | 聊天后端验证 JWT | `AI-talent scout/server.js:2621-2777` | 验证 → 查找/创建用户 → 写 session |
| 10 | 设置 Cookie，返回用户信息 | `AI-talent scout/lib/cookie-helper.js:43-66` | `token=UUID; HttpOnly; Path=/; Max-Age=2592000` |

**回访流程（已有长期 Cookie）：**

| 步骤 | 用户/系统动作 | 涉及的接口/文件 | 说明 |
|------|--------------|----------------|------|
| R1 | 用户再次访问 `/platform-login` | [PlatformLogin/index.tsx:13-36](src/pages/PlatformLogin/index.tsx#L13-L36) | `useEffect` 自动调用 `GET /api/platform/check-login` |
| R2 | 长期 Cookie 有效 → 重新签发 sso_token | [platform-auth/server.js:197-235](platform-auth/server.js#L197-L235) | 验证 `platform_login` Cookie → 签发新的 30 分钟 sso_token |
| R3 | 自动跳转模块选择页 | [PlatformLogin/index.tsx:24](src/pages/PlatformLogin/index.tsx#L24) | `navigate('/login?sso_token=新JWT')` |
| R4 | 后续流程同首次登录步骤 5–10 | — | — |

**退出流程：**

| 步骤 | 用户/系统动作 | 涉及的接口/文件 | 说明 |
|------|--------------|----------------|------|
| L1 | 用户点击个人中心 → 退出登录 | [Login/index.tsx:150-158](src/pages/Login/index.tsx#L150-L158) | 调用 `POST /api/platform/logout` |
| L2 | 清除长期 Cookie | [platform-auth/server.js:238-241](platform-auth/server.js#L238-L241) | `Set-Cookie: platform_login=; Max-Age=0` |
| L3 | 跳转回登录页 | [Login/index.tsx:157](src/pages/Login/index.tsx#L157) | `window.location.href = '/platform-login'` |

> **注意**：步骤 6–10 目前仅「自然聊天观察」模块已完成接入。其他三个模块（故事共创、深海基地重建、职业体验）的入口页面（`Login/index.tsx`）已在卡片链接上携带了 `sso_token`（未登录时则回退到 `/platform-login`），但对应的子模块页面尚未实现 sso_token 的消费逻辑。

---

## 二、涉及的所有接口

### 2.1 `POST /api/platform/register`

| 项目 | 详情 |
|------|------|
| **所在文件** | [platform-auth/server.js:112-148](platform-auth/server.js#L112-L148) |
| **方法** | POST |
| **代理** | Vite → `localhost:4000`（配置于 [vite.config.ts:11-14](vite.config.ts#L11-L14)） |

**请求体**：
```json
{
  "platformUid": "S2024002",
  "username": "小刚",
  "password": "abcd1234"
}
```

**校验规则**：
- `platformUid`：必填，非空字符串，格式必须为 `S` + 7 位数字（如 `S2024001`）
- `username`：必填，非空字符串
- `password`：必填，字符串，长度 ≥ 8 字符，且必须同时包含字母和数字

**成功响应（201）**：
```json
{
  "message": "注册成功",
  "platformUid": "S2024002"
}
```

**失败响应（400 — 字段校验失败）**：
```json
{ "error": "请提供有效的学号 (platformUid)" }
```
```json
{ "error": "学号格式不正确，应为 S 加7位数字，例如 S2024001" }
```
```json
{ "error": "请提供用户名 (username)" }
```
```json
{ "error": "密码至少需要8位，且需包含字母和数字" }
```

**失败响应（409 — 学号重复）**：
```json
{ "error": "学号 S2024002 已注册" }
```

> **说明**：密码强度校验已从前期的"≥4 字符"升级为"≥8 字符 + 字母数字混合"。前端 [PlatformRegister/index.tsx:20](src/pages/PlatformRegister/index.tsx#L20) 和后端 [platform-auth/server.js:119,125](platform-auth/server.js#L119) 均执行相同的校验规则。

---

### 2.2 `POST /api/platform/login`

| 项目 | 详情 |
|------|------|
| **所在文件** | [platform-auth/server.js:150-189](platform-auth/server.js#L150-L189) |
| **方法** | POST |
| **代理** | Vite → `localhost:4000` |

**请求体**：
```json
{
  "platformUid": "S2024001",
  "password": "123456"
}
```

**校验规则**：
- `platformUid`：必填，非空字符串
- `password`：必填，非空字符串

**成功响应（200）**：
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwbGF0Zm9ybVVpZCI6IlMyMDI0MDAxIiwidXNlcm5hbWUiOiLlsI_mmI4iLCJpYXQiOjE3NTQwNDQ4MDAsImV4cCI6MTc1NDA0NjYwMCwianRpIjoiNzExZWM5MjUtYjIwYS00MmFiLTkzZWUtNzY0MzZhYzY3MmEwIn0.xxx"
}
```

同时设置响应头：
```
Set-Cookie: platform_login=<long-term-jwt>; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000
```

JWT payload 结构（解码后，短期 sso_token）：
```json
{
  "platformUid": "S2024001",
  "username": "小明",
  "iat": 1754044800,
  "exp": 1754046600,
  "jti": "711ec925-b20a-42ab-93ee-76436ac672a0"
}
```

- 短期 sso_token 算法：HS256，有效期：30 分钟（`TOKEN_EXPIRES_IN`）
- 长期 Cookie `platform_login`：同样 HS256，有效期 30 天（`LONG_TERM_EXPIRES`），HttpOnly，用于回访时的免密自动登录

**失败响应（400）**：
```json
{ "error": "请提供学号 (platformUid)" }
```

**失败响应（401）**：
```json
{ "error": "学号不存在或密码错误" }
```

（注意：学号不存在和密码错误返回相同的错误信息，不区分。）

---

### 2.3 `GET /api/platform/health`

| 项目 | 详情 |
|------|------|
| **所在文件** | [platform-auth/server.js:192-194](platform-auth/server.js#L192-L194) |
| **方法** | GET |

**成功响应（200）**：
```json
{
  "status": "ok",
  "service": "platform-auth"
}
```

---

### 2.4 `GET /api/platform/check-login`

| 项目 | 详情 |
|------|------|
| **所在文件** | [platform-auth/server.js:197-235](platform-auth/server.js#L197-L235) |
| **方法** | GET |
| **说明** | 检查长期登录 Cookie 是否有效，有效则重新签发临时 sso_token（用于回访免密登录） |

**请求**：无请求体，Cookie 中自动携带 `platform_login`（由浏览器发送）。

**校验规则**：
- 请求必须携带名为 `platform_login` 的 Cookie
- Cookie 值为有效的长期 JWT（HS256，由相同 `SECRET` 签发）
- JWT payload 中的 `platformUid` 对应的账号在 `accounts.json` 中仍然存在

**成功响应（200）**：
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```
返回的是新签发的短期 sso_token（30 分钟有效）。

**失败响应（401）**：
```json
{ "error": "未登录" }
```
```json
{ "error": "登录已过期，请重新登录" }
```
```json
{ "error": "登录凭证无效" }
```
```json
{ "error": "账号不存在" }
```

---

### 2.5 `POST /api/platform/logout`

| 项目 | 详情 |
|------|------|
| **所在文件** | [platform-auth/server.js:238-241](platform-auth/server.js#L238-L241) |
| **方法** | POST |
| **说明** | 清除长期登录 Cookie，实现总平台端登出 |

**请求**：无请求体。

**成功响应（200）**：
```json
{ "ok": true, "message": "已退出登录" }
```

同时设置响应头清除 Cookie：
```
Set-Cookie: platform_login=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0
```

> **注意**：此接口仅清除总平台的长期登录 Cookie。聊天模块的 session Cookie（`token` / `token_t`）不受影响，两个系统的登出未联动。

---

### 2.6 `POST /api/auth/sso-login`

| 项目 | 详情 |
|------|------|
| **所在文件** | `AI-talent scout/server.js:2621-2777` |
| **方法** | POST |
| **说明** | 聊天模块接口，由总平台通过 iframe 调用 |

**请求体**：
```json
{
  "sso_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**成功响应（200）**：
```json
{
  "ok": true,
  "user": {
    "id": "user-1785579138894",
    "username": "小琪",
    "role": "student",
    "studentCode": "884016",
    "onboardingDone": true,
    "platformUid": "S2024003"
  }
}
```

同时设置响应头：
```
Set-Cookie: token=<random-uuid>; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000
```
（HTTPS 环境下 `SameSite=None; Secure`）

**失败响应（400）**：
```json
{ "error": "缺少 sso_token 参数" }
```
```json
{ "error": "SSO Token 中缺少 platformUid" }
```

**失败响应（401）**：
```json
{ "error": "SSO Token 已过期" }
```
```json
{ "error": "SSO Token 无效" }
```

**失败响应（500）**：
```json
{ "error": "服务端未配置 SSO_SECRET_KEY" }
```

**内部处理逻辑（server.js:2675-2748）**：

1. 在 `users.json` 中按 `platformUid` 查找已有用户
2. **找不到** → 自动创建新用户记录：
   - `id`：`user-{timestamp}`
   - `username`：优先取 JWT 中的 `username`，回退到 `platformUid`
   - `passwordHash`：随机生成（`sso-{platformUid}-{timestamp}` 的 bcrypt 哈希）
   - `role`：固定 `"student"`
   - `studentCode`：随机 6 位数字（去重）
   - `platformUid`：写入 JWT 中的 platformUid
   - `onboardingDone`：false
3. **找到且 username 仍等于 platformUid** → 用 JWT 中的 `username` 更新覆盖

---

## 三、密钥与敏感配置现状

### 3.1 环境变量清单

| 变量名 | 用途 | 所在文件 | 是否已配置 |
|--------|------|----------|-----------|
| `PLATFORM_SSO_SECRET` | JWT 签名密钥（总平台端） | `platform-auth/.env` | ✅ 已配置 |
| `PLATFORM_SSO_SECRET` | 同上，fallback 硬编码默认值 | `platform-auth/server.js:20-27` | ⚠️ env 未设置时有 fallback |
| `SSO_SECRET_KEY` | JWT 签名密钥（聊天模块端） | `AI-talent scout/.env` | ✅ 已配置 |
| `COOKIE_SECURE` | Cookie Secure 标志 | `AI-talent scout/.env` | ❌ 未配置（由 NODE_ENV 决定） |
| `TRUST_PROXY` | 反向代理信任级别 | `AI-talent scout/.env` | ❌ 未配置（默认 false） |
| `NODE_ENV` | 运行环境 | `AI-talent scout/.env` | ❌ 未配置（默认 development） |
| `TEACHER_INVITE_CODE` | 教师注册邀请码 | `AI-talent scout/.env` | ✅ 已配置（不属 SSO 范畴） |
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 | `AI-talent scout/.env` | ✅ 已配置（不属 SSO 范畴） |

### 3.2 两边密钥一致性

- **总平台** `platform-auth/.env` 中的 `PLATFORM_SSO_SECRET` 当前值为：`platform-sso-demo-secret-do-not-use-in-production`
- **聊天模块** `AI-talent scout/.env` 中的 `SSO_SECRET_KEY` 当前值为：`platform-sso-demo-secret-do-not-use-in-production`
- **两边已确认一致**。

> **注意**：两个 `.env.example` 文件中的示例默认值**不一致**（总平台示例为 `platform-sso-demo-secret-do-not-use-in-production`，聊天模块示例为 `ai-talent-scout-sso-dev-2026`）。`.env` 实际文件已手动对齐，但模板文件尚未统一。

### 3.3 Token 有效期

| 参数 | 值 | 定义位置 |
|------|-----|---------|
| `TOKEN_EXPIRES_IN` | `'30m'`（30 分钟） | [platform-auth/server.js:14](platform-auth/server.js#L14) |
| `LONG_TERM_EXPIRES` | `'30d'`（30 天） | [platform-auth/server.js:16](platform-auth/server.js#L16) |
| `LONG_TERM_MAX_AGE` | `2592000`（30 天，秒） | [platform-auth/server.js:17](platform-auth/server.js#L17) |

- 短期 sso_token：
  - 算法：HS256
  - JWT payload 包含 `iat`（签发时间）、`exp`（过期时间）、`jti`（jwtid，UUID 去重）
  - 聊天模块验证时使用 `jwt.verify(token, SSO_SECRET_KEY, { algorithms: ['HS256'] })`
  - 过期 token → 返回 401 `{ error: 'SSO Token 已过期' }`
- 长期 Cookie `platform_login`：
  - 同样 HS256，payload 额外包含 `type: 'long-term'` 字段
  - 用于回访时通过 `GET /api/platform/check-login` 免密重新签发短期 sso_token
  - 登出时通过 `POST /api/platform/logout` 清除（`Max-Age=0`）
- 前端 UI 提示"Token 有效期 5 分钟"（[PlatformLogin/index.tsx:217](src/pages/PlatformLogin/index.tsx#L217)），但后端实际配置为 30 分钟，存在不一致。

### 3.4 Session/Cookie 有效期

**总平台端（platform-auth）**：

| Cookie 名 | 类型 | 有效期 | 属性 |
|-----------|------|--------|------|
| `platform_login` | JWT（HS256） | 30 天 | `HttpOnly; SameSite=Lax; Path=/` |

**聊天模块端（AI-talent scout）**：

| 参数 | 值 | 定义位置 |
|------|-----|---------|
| `TOKEN_MAX_AGE_SECONDS` | `2592000`（30 天） | `AI-talent scout/lib/cookie-helper.js:21` |
| Session `expiresAt` | `Date.now() + 30 * 24 * 60 * 60 * 1000` | `server.js:2757`（多处） |

- Cookie 属性：`HttpOnly; Path=/; SameSite=Lax`（HTTP 环境）或 `SameSite=None; Secure`（HTTPS 环境）
- Session 存储在 `data/sessions.json`，过期 session 在下次读取时惰性清除
- 学生和教师使用不同 Cookie 名：`token`（学生）、`token_t`（教师）

---

## 四、账号数据现状

### 4.1 总平台端（platform-auth）

**存储路径**：`platform-auth/data/accounts.json`

**初始化方式**：首次启动时自动创建（`seedIfEmpty()`），播种一个种子账号。

**数据结构**（每条记录）：
```json
{
  "platformUid": "S2024001",
  "username": "小明",
  "passwordHash": "$2b$10$..."
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `platformUid` | string | 主键，学号，唯一标识。用于注册时的唯一性检查 |
| `username` | string | 用户显示名（中文） |
| `passwordHash` | string | bcrypt 10 轮哈希，不存明文 |

**存储方式**：纯 JSON 文件，读写通过 `readAccounts()` / `writeAccounts()`。无数据库。

### 4.2 聊天模块端（AI-talent scout）

**存储路径**：`data/users.json`

**数据结构**（每条记录）：
```json
{
  "id": "user-1785579138894",
  "username": "小琪",
  "passwordHash": "$2b$10$...",
  "role": "student",
  "studentCode": "884016",
  "platformUid": "S2024003",
  "onboardingDone": true,
  "createdAt": "2026-08-01T10:12:18.894Z"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 主键，格式 `user-{timestamp}` |
| `username` | string | 显示名。SSO 创建时优先取 JWT 中的 `username` |
| `passwordHash` | string | 密码哈希。SSO 创建时为随机哈希（用户不通过密码登录） |
| `role` | string | `"student"` 或 `"teacher"`。SSO 创建的固定为 `"student"` |
| `studentCode` | string | 6 位随机数字，唯一 |
| `platformUid` | string \| null | 关联总平台学号。SSO 创建时写入。**SSO 接入前创建的旧用户此字段为 `null`** |
| `onboardingDone` | boolean | 新手引导是否完成 |
| `createdAt` | string | ISO 8601 创建时间 |

### 4.3 `platformUid` 字段与已有 `id`/`username` 字段的共存关系

- **`id`**：聊天模块的内部主键（`user-{timestamp}`），所有用户都有。与 `platformUid` 无关。
- **`username`**：显示名称。在 SSO 场景下取值优先级：
  1. JWT token 中的 `username` 字段（如 "小琪"）
  2. 回退到 JWT 中的 `platformUid`（如 "S2024003"）
  3. 如果已有用户记录的 `username` 仍然是学号，SSO 登录时会自动更新为 JWT 中的真实姓名
- **`platformUid`**：SSO 关联字段。
  - SSO 接入前的旧用户：`platformUid: null`
  - SSO 创建的新用户：`platformUid: "S2024003"`
  - SSO 登录时通过 `users.find(u => u.platformUid === platformUid)` 查找匹配用户
  - **注意**：一个 `platformUid` 在聊天模块端只对应一个用户记录；如果该记录被手动删除，下次 SSO 登录会重新创建一条新记录

**两个系统的关联方式**：通过 `platformUid` 字段实现松散关联。总平台 `accounts.json` 的 `platformUid` 与聊天模块 `users.json` 的 `platformUid` 对应。

---

## 五、已知的限制和未完成事项

以下事项在 [统一登录功能-开发说明.md](统一登录功能-开发说明.md) 中已有记录，以及从代码审查中发现的额外项：

### 5.1 CSRF 保护
- **当前状态**：未实现。
- Session Cookie 设置了 `SameSite=Lax`（提供基本的跨站请求伪造防护），但没有 CSRF token 机制。

### 5.2 密码强度校验
- **当前状态**：≥8 字符 + 必须同时包含字母和数字（[platform-auth/server.js:125](platform-auth/server.js#L125)）。
- 无大小写或特殊字符要求。
- 前端 [PlatformRegister/index.tsx:20](src/pages/PlatformRegister/index.tsx#L20) 和后端均执行相同的校验规则。
- 学号格式也增加了校验：必须为 `S` + 7 位数字（[platform-auth/server.js:119](platform-auth/server.js#L119)）。

### 5.3 登出功能
- **总平台端**：已实现 `POST /api/platform/logout`（[platform-auth/server.js:238-241](platform-auth/server.js#L238-L241)），清除长期 Cookie `platform_login`。前端 [Login/index.tsx:150-158](src/pages/Login/index.tsx#L150-L158) 可通过个人中心下拉菜单触发退出。
- **聊天模块端**：有登出路由 `POST /api/auth/logout`（`server.js:2779+`），会清除 session Cookie。但总平台的登出不会联动调用它。
- **两个系统的登出没有联动**：退出总平台后，聊天模块的 session Cookie 仍然有效。

### 5.4 HttpOnly Cookie
- **聊天模块端**：session Cookie 已启用 HttpOnly（[cookie-helper.js:56](lib/cookie-helper.js#L56)）。
- **sso_token（JWT）**：通过 URL Query String 明文传递，未使用 HttpOnly Cookie。Token 在浏览器地址栏和 iframe src 中可见。

### 5.5 速率限制（Rate Limiting）
- **当前状态**：未实现。登录和注册接口无请求频率限制。

### 5.6 测试覆盖
- **聊天模块**：有部分测试文件（`test/` 目录，含 `background-ai.test.js`、`security-lite.test.js` 等），但无专门的 SSO 流程测试。
- **总平台 platform-auth**：无测试文件。

### 5.7 其他模块接入状态
- ✅ 自然聊天观察（ChatObserve）：已完成 SSO 接入
- ❌ 故事共创（StoryCreate）：`Login/index.tsx` 卡片链接已携带 `sso_token`，但 `StoryCreate` 组件未消费
- ❌ 深海基地重建（CampusDesign）：同上
- ❌ 职业体验（CareerSim）：同上

### 5.8 Token 有效期 UI 不一致
- 前端 UI 显示"Token 有效期 5 分钟"（[PlatformLogin/index.tsx:217](src/pages/PlatformLogin/index.tsx#L217)），后端实际配置为 30 分钟（[platform-auth/server.js:14](platform-auth/server.js#L14)）。

### 5.9 JWT 密钥 fallback 硬编码
- [platform-auth/server.js:23-30](platform-auth/server.js#L23-L30)：环境中未设置 `PLATFORM_SSO_SECRET` 时，会回退到硬编码的默认值并打印警告。聊天模块端没有此 fallback（未配置时直接返回 500）。

### 5.10 签名算法未显式在签发端约束
- 签发短期 sso_token 时（[platform-auth/server.js:173-177](platform-auth/server.js#L173-L177)）和签发长期 `platform_login` 时（[platform-auth/server.js:180-184](platform-auth/server.js#L180-L184)）均未显式指定 `{ algorithm: 'HS256' }`，依赖 jsonwebtoken 库的默认值。验证端（聊天模块和 `check-login`）已显式约束 `{ algorithms: ['HS256'] }`。

### 5.11 调试代码残留
- 聊天模块 `server.js` 的 SSO 接口中包含大量 `[DEBUG-1]` ~ `[DEBUG-5]` 和 `[DEBUG-UPDATE]` 调试日志（行 2628–2746），用于排查中文用户名编码问题。这些在生产环境中会产生大量日志输出。

### 5.12 sso_token 经 URL 明文传递
- sso_token（JWT）通过 URL Query String 从总平台传递到各模块页面和 iframe（如 `/chat-observe?sso_token=xxx`、`home.html?sso_token=xxx`）。
- Token 在浏览器地址栏、iframe src 属性、以及 `Login/index.tsx` 的页面内随处可见。
- 短期 sso_token 虽为 30 分钟有效，但在此期间若被截获（如浏览器历史记录、日志），可被重放。
- 长期 Cookie `platform_login` 已使用 HttpOnly，缓解了持久凭证的暴露风险，但短期 token 的传输方式未变。

---

## 六、最近解决过的问题

以下为此轮 SSO 接入过程中实际遇到并已解决的问题（按时间倒序）：

### 6.1 Cookie 跨域问题（SameSite / Secure）
- **现象**：总平台通过 iframe 嵌入聊天模块时，Cookie 无法正确写入。
- **原因**：聊天模块运行在 `localhost:3000`，总平台在 `localhost:5173`，浏览器视为跨站请求。早期 ngrok 地址下 HTTPS 环境需要 `SameSite=None; Secure`。
- **解决**：创建了统一的 `cookie-helper.js` 模块，根据请求环境（HTTP/HTTPS）动态设置 `SameSite` 和 `Secure` 属性（[cookie-helper.js](lib/cookie-helper.js)）。同时添加了 CSP 头 `frame-ancestors 'self' http://localhost:5173` 放行总平台嵌套（[security-headers.js](lib/security-headers.js)）。

### 6.2 中文用户名编码问题
- **现象**：JWT 中包含中文用户名（如 "小刚"），聊天模块解码后出现乱码或空值。
- **排查过程**：在两端的签发、传输、解码各环节添加了 hex dump 日志（尚保留在代码中）。
- **解决**：确认 JWT 标准使用 UTF-8 编码，`jsonwebtoken` 库默认正确处理。问题根源为中间某次手动测试时使用了错误的 Base64 编码方式。最终验证通过（`users.json` 中已正确存储中文用户名如 "小琪"）。

### 6.3 密钥不一致
- **现象**：总平台签发的 JWT 到聊天模块验证失败。
- **原因**：两个 `.env.example` 模板文件中的默认密钥值不同。
- **解决**：手动对齐了两个 `.env` 实际文件中的密钥值。模板文件尚未统一（见 3.2 节注意项）。

### 6.4 Session Cookie 命名冲突
- **现象**：教师和学生角色共用同一个 Cookie 名（`token`），导致角色切换时互相覆盖、页面跳转异常。
- **解决**：分离为 `token`（学生）和 `token_t`（教师）两个 Cookie 名（[cookie-helper.js:69-70](lib/cookie-helper.js#L69-L70)）。

### 6.5 用户名校验与更新逻辑
- **现象**：旧用户在 SSO 接入前用户名等于学号（如 "S2024002"），SSO 登录后未自动更新为真实姓名。
- **解决**：在 SSO 登录接口中增加判断：如果已有用户记录的 `username === platformUid` 且 JWT 中的 `username` 不相等，则自动更新（`server.js:2733-2748`）。

### 6.6 退出按钮在 iframe 场景下的跳转
- **现象**：用户在 iframe 内点击退出后，无法正确跳回总平台。
- **解决**：通过 `parentOrigin` URL 参数 + `sessionStorage` 双保险机制，实现 `doLogoutRedirect` 自适应跳转。

### 6.7 回访免密登录（长期 Cookie）
- **现象**：用户每次打开 `/platform-login` 都需要重新输入学号和密码，体验不佳。
- **解决**：登录时额外签发长期 JWT Cookie `platform_login`（30 天有效，HttpOnly）。新增 `GET /api/platform/check-login` 接口用于验证长期 Cookie 并重新签发短期 sso_token。`PlatformLogin` 页面挂载时自动调用此接口，Cookie 有效则直接跳转到模块选择页，无需再次输入密码。

### 6.8 总平台登出功能
- **现象**：总平台原本没有登出能力，用户无法主动退出。
- **解决**：新增 `POST /api/platform/logout` 接口清除长期 Cookie。`Login` 页面新增个人中心下拉菜单，提供"退出登录"按钮。

### 6.9 密码强度升级
- **现象**：注册时密码仅要求 ≥4 字符，过于薄弱。
- **解决**：前端 ([PlatformRegister/index.tsx:20](src/pages/PlatformRegister/index.tsx#L20)) 和后端 ([platform-auth/server.js:125](platform-auth/server.js#L125)) 同步升级为 ≥8 字符 + 必须同时包含字母和数字。学号格式也增加了 `S + 7位数字` 的格式校验。

### 6.10 登录页 JWT 客户端解码
- **现象**：模块选择页（`Login`）需要显示当前用户名，但之前只从 URL 参数中读取。
- **解决**：在 [Login/index.tsx:52-69](src/pages/Login/index.tsx#L52-L69) 实现了客户端 JWT 解码函数 `decodeJwtPayload`，使用 `TextDecoder` 正确处理 UTF-8 中文用户名。同时通过 `/check-login` 接口确保回访用户（无 URL token）也能获取到用户信息。

---

## 附录

### A. 项目文件索引

**总平台（ai-child-talent-platform）新增文件：**
| 文件 | 用途 |
|------|------|
| `platform-auth/server.js` | 登录/注册后端，JWT 签发，长期 Cookie，check-login，logout |
| `platform-auth/package.json` | Express + bcrypt + jsonwebtoken |
| `platform-auth/.env` | JWT 密钥配置 |
| `platform-auth/.env.example` | 环境变量模板 |
| `platform-auth/data/accounts.json` | 账号存储（自动创建） |
| `src/pages/PlatformLogin/index.tsx` | 登录页面 + 自动检测长期 Cookie 免密登录 |
| `src/pages/PlatformRegister/index.tsx` | 注册页面（含前端密码强度校验） |

**总平台修改文件：**
| 文件 | 改动 |
|------|------|
| `src/App.tsx` | 新增 `/platform-login`、`/platform-register` 路由 |
| `src/pages/Login/index.tsx` | 新增个人中心下拉菜单（用户信息展示 + 退出登录）；从 URL 读取 sso_token 并客户端解码 JWT 显示用户名；调用 `/check-login` 验证长期 Cookie；未登录时卡片链接回退到 `/platform-login` |
| `src/pages/ChatObserve/index.tsx` | 读取 sso_token，有 token 时 iframe 指向本地服务，无 token 时回退到 ngrok 地址 |
| `vite.config.ts` | 新增 `/api/platform` → `localhost:4000` 代理 |

**聊天模块（AI-talent scout）修改文件：**
| 文件 | 改动 |
|------|------|
| `server.js` | 新增 `POST /api/auth/sso-login`，含用户自动创建/更新逻辑 |
| `public/home.html` | 新增 SSO 自动登录前端逻辑 |
| `.env` | 新增 `SSO_SECRET_KEY` |
| `.env.example` | 新增 `SSO_SECRET_KEY` 示例 |
| `lib/cookie-helper.js` | 统一 Cookie 构建（新增） |
| `lib/security-headers.js` | CSP frame-ancestors 头（新增） |
| `lib/env-config.js` | 环境变量安全解析（新增） |
| `data/migrate-to-users.js` | 数据迁移脚本（新增） |

### B. 端口与服务一览

| 服务 | 端口 | 说明 |
|------|------|------|
| Vite 前端 | 5173 | 总平台 React 开发服务器 |
| platform-auth | 4000 | SSO 登录/注册后端（新增） |
| AI-talent scout | 3000 | 聊天模块全栈服务 |
| story-backend | 8000 | 故事共创后端（未涉及 SSO） |
| career-sim | 8005 | 职业体验后端（未涉及 SSO） |

### C. 启动命令

```bash
# 终端 1：统一登录后端
cd platform-auth && node server.js

# 终端 2：总平台前端
npm run dev

# 终端 3：聊天模块（如需测试聊天功能）
cd "d:/claude/AI-talent scout" && node server.js
```
