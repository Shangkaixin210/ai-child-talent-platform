/**
 * 🔐 统一登录（SSO）工具 — 识别"从 AI 伯乐总平台进入"的学生身份
 * ────────────────────────────────────────────────
 * 深海基地模块没有自己的账号体系（场景一），只做身份识别：
 *   1. 从 URL 读取总平台签发的短期 sso_token
 *   2. POST /api/assessment/sso-verify 交给后端（Python :8005）验证
 *   3. 用返回的 platformUid 作为本次游戏会话的 studentId，关联所有数据
 *
 * 相对路径 /api/assessment/sso-verify 在两种运行方式下都能路由到 8005：
 *   - 嵌入总平台（5173 主 Vite 代理）：/api/assessment → localhost:8005
 *   - 深海基地独立开发（3001，本应用 vite.config.js 代理）：/api → localhost:8005
 */

/** 从当前 iframe URL 读取 sso_token */
export function getSsoTokenFromUrl() {
  return new URLSearchParams(window.location.search).get('sso_token')
}

/**
 * 向后端验证 sso_token，成功返回 { ok, platformUid, username }
 * 失败（token 无效/过期/后端未启动）抛出 Error。
 */
export async function verifySsoToken(ssoToken) {
  const res = await fetch('/api/assessment/sso-verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sso_token: ssoToken }),
  })

  let data
  try {
    data = await res.json()
  } catch {
    data = {}
  }

  if (!res.ok) {
    throw new Error(data.detail || `统一登录验证失败（HTTP ${res.status}）`)
  }

  if (!data.platformUid) {
    throw new Error('统一登录凭证缺少学号')
  }

  return data
}

/** 从 iframe URL 中移除 sso_token（一次性凭证用完后清掉，避免长期留在地址栏） */
export function stripSsoTokenFromUrl() {
  const url = new URL(window.location.href)
  if (!url.searchParams.has('sso_token')) return
  url.searchParams.delete('sso_token')
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}
