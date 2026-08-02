import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcrypt'
import cors from 'cors'
import express from 'express'
import jwt from 'jsonwebtoken'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = 4000
const TOKEN_EXPIRES_IN = '30m'
const LONG_TERM_COOKIE = 'platform_login'
const LONG_TERM_EXPIRES = '30d'
const LONG_TERM_MAX_AGE = 30 * 24 * 60 * 60 // 30 days in seconds
const BCRYPT_ROUNDS = 10
const DATA_DIR = path.join(__dirname, 'data')
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json')

// Secret: prefer env, fall back to a demo-only default with a warning
const SECRET =
  process.env.PLATFORM_SSO_SECRET ||
  (() => {
    console.warn(
      '⚠  PLATFORM_SSO_SECRET 未设置，使用本地演示默认密钥（仅用于开发演示，不要在生产环境使用）',
    )
    return 'platform-sso-demo-secret-do-not-use-in-production'
  })()

// ── helpers ──────────────────────────────────────────────────────────

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    console.log(`[platform-auth] 创建数据目录 → ${DATA_DIR}`)
  }
}

function readAccounts() {
  ensureDataDir()
  if (!fs.existsSync(ACCOUNTS_FILE)) {
    return []
  }
  try {
    const raw = fs.readFileSync(ACCOUNTS_FILE, 'utf-8')
    return JSON.parse(raw)
  } catch {
    console.error('[platform-auth] 读取 accounts.json 失败，返回空列表')
    return []
  }
}

function writeAccounts(accounts) {
  ensureDataDir()
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2), 'utf-8')
}

// ── cookie helpers ────────────────────────────────────────────────────

function parseCookies(cookieHeader) {
  if (!cookieHeader) return {}
  const cookies = {}
  cookieHeader.split(';').forEach((pair) => {
    const idx = pair.indexOf('=')
    if (idx === -1) return
    const name = pair.substring(0, idx).trim()
    const value = pair.substring(idx + 1).trim()
    if (name) cookies[name] = decodeURIComponent(value)
  })
  return cookies
}

function buildLongTermCookie(token, maxAge) {
  const parts = [
    `${LONG_TERM_COOKIE}=${token}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${maxAge > 0 ? maxAge : 0}`,
  ]
  return parts.join('; ')
}

// ── seed account ─────────────────────────────────────────────────────

async function seedIfEmpty() {
  const accounts = readAccounts()
  if (accounts.length > 0) return

  const hash = await bcrypt.hash('123456', BCRYPT_ROUNDS)
  const seed = [
    {
      platformUid: 'S2024001',
      username: '小明',
      passwordHash: hash,
    },
  ]
  writeAccounts(seed)
  console.log('[platform-auth] 已创建种子账号: S2024001 / 123456 (仅用于本地演示)')
}

// ── app ──────────────────────────────────────────────────────────────

const app = express()
app.use(cors())

app.use(express.json())

// POST /api/platform/register
app.post('/api/platform/register', async (req, res) => {
  const { platformUid, username, password } = req.body

  // Validate required fields
  if (!platformUid || typeof platformUid !== 'string' || platformUid.trim().length === 0) {
    return res.status(400).json({ error: '请提供有效的学号 (platformUid)' })
  }
  if (!/^S\d{7}$/.test(platformUid.trim())) {
    return res.status(400).json({ error: '学号格式不正确，应为 S 加7位数字，例如 S2024001' })
  }
  if (!username || typeof username !== 'string' || username.trim().length === 0) {
    return res.status(400).json({ error: '请提供用户名 (username)' })
  }
  if (!password || typeof password !== 'string' || password.length < 8 || !/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password)) {
    return res.status(400).json({ error: '密码至少需要8位，且需包含字母和数字' })
  }

  const accounts = readAccounts()

  // Check duplicate
  if (accounts.some((a) => a.platformUid === platformUid.trim())) {
    return res.status(409).json({ error: `学号 ${platformUid.trim()} 已注册` })
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
  const newAccount = {
    platformUid: platformUid.trim(),
    username: username.trim(),
    passwordHash,
  }

  accounts.push(newAccount)
  writeAccounts(accounts)

  console.log(`[platform-auth] 注册成功 → ${platformUid.trim()} (${username.trim()})`)
  return res.status(201).json({ message: '注册成功', platformUid: platformUid.trim() })
})

// POST /api/platform/login
app.post('/api/platform/login', async (req, res) => {
  const { platformUid, password } = req.body

  if (!platformUid || typeof platformUid !== 'string' || platformUid.trim().length === 0) {
    return res.status(400).json({ error: '请提供学号 (platformUid)' })
  }
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: '请提供密码 (password)' })
  }

  const accounts = readAccounts()
  const account = accounts.find((a) => a.platformUid === platformUid.trim())

  if (!account) {
    return res.status(401).json({ error: '学号不存在或密码错误' })
  }

  const match = await bcrypt.compare(password, account.passwordHash)
  if (!match) {
    return res.status(401).json({ error: '学号不存在或密码错误' })
  }

  const token = jwt.sign(
    { platformUid: account.platformUid, username: account.username },
    SECRET,
    { expiresIn: TOKEN_EXPIRES_IN, jwtid: crypto.randomUUID() },
  )

  // 签发长期登录凭证（30 天），用于"免密登录"
  const longTermToken = jwt.sign(
    { platformUid: account.platformUid, username: account.username, type: 'long-term' },
    SECRET,
    { expiresIn: LONG_TERM_EXPIRES, jwtid: crypto.randomUUID() },
  )
  res.setHeader('Set-Cookie', buildLongTermCookie(longTermToken, LONG_TERM_MAX_AGE))

  console.log(`[platform-auth] 登录成功 → ${account.platformUid} (${account.username})`)
  return res.json({ token })
})

// Health check
app.get('/api/platform/health', (_req, res) => {
  res.json({ status: 'ok', service: 'platform-auth' })
})

// GET /api/platform/check-login — 检查长期登录 Cookie 是否有效，有效则重新签发临时 sso_token
app.get('/api/platform/check-login', (req, res) => {
  const cookies = parseCookies(req.headers.cookie)
  const longTermToken = cookies[LONG_TERM_COOKIE]

  if (!longTermToken) {
    return res.status(401).json({ error: '未登录' })
  }

  let decoded
  try {
    decoded = jwt.verify(longTermToken, SECRET, { algorithms: ['HS256'] })
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: '登录已过期，请重新登录' })
    }
    return res.status(401).json({ error: '登录凭证无效' })
  }

  if (!decoded.platformUid) {
    return res.status(401).json({ error: '登录凭证无效' })
  }

  // 检查账号是否还存在（可能被手动删除）
  const accounts = readAccounts()
  const account = accounts.find((a) => a.platformUid === decoded.platformUid)
  if (!account) {
    return res.status(401).json({ error: '账号不存在' })
  }

  // 重新签发临时 sso_token（30 分钟）
  const ssoToken = jwt.sign(
    { platformUid: account.platformUid, username: account.username },
    SECRET,
    { expiresIn: TOKEN_EXPIRES_IN, jwtid: crypto.randomUUID() },
  )

  console.log(`[platform-auth] 自动登录 → ${account.platformUid} (${account.username})`)
  return res.json({ token: ssoToken })
})

// POST /api/platform/logout — 清除长期登录 Cookie
app.post('/api/platform/logout', (_req, res) => {
  res.setHeader('Set-Cookie', buildLongTermCookie('', 0))
  return res.json({ ok: true, message: '已退出登录' })
})

// ── start ────────────────────────────────────────────────────────────

app.listen(PORT, async () => {
  await seedIfEmpty()
  console.log(`[platform-auth] 统一登录服务已启动 → http://localhost:${PORT}`)
  console.log(`[platform-auth] Token 有效期: ${TOKEN_EXPIRES_IN}（临时跳转凭证）`)
  console.log(`[platform-auth] 长期登录 Cookie: ${LONG_TERM_COOKIE}, 有效期: ${LONG_TERM_EXPIRES}`)
  console.log(`[platform-auth] 账号存储: ${ACCOUNTS_FILE}`)
})
