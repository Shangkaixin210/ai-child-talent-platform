import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

// AI伯乐·探索空间 聊天模块（独立 Express 进程，端口 3000）
// 仅开放学生端入口，教师端不可从此处访问
//
// 自动检测运行环境：本地开发 → localhost:3000；同 hostname 访问（如局域网）→ 同 host:3000
function getChatBase(): string {
  const hostname = window.location.hostname
  // localhost / 127.x → 直接用本地
  if (hostname === 'localhost' || hostname.startsWith('127.')) {
    return 'http://localhost:3000'
  }
  // 局域网/公网 IP → 同 hostname，端口 3000
  return `${window.location.protocol}//${hostname}:3000`
}

function ChatObserve() {
  const [searchParams] = useSearchParams()
  const ssoTokenFromUrl = searchParams.get('sso_token')

  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [ssoToken, setSsoToken] = useState<string | null>(ssoTokenFromUrl)
  const [checkingToken, setCheckingToken] = useState(true)
  const loadingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const iframeLoaded = useRef(false)

  // On mount: try to get a fresh sso_token via /check-login.
  // This handles the case where the URL token has expired (30 min) —
  // we get a new one from the long-term cookie instead.
  useEffect(() => {
    let cancelled = false

    async function ensureToken() {
      // If we already have a token from the URL, we still validate it
      // via /check-login to get a potentially fresher one.
      try {
        const res = await fetch('/api/platform/check-login', {
          credentials: 'include',
        })
        if (cancelled) return
        if (res.ok) {
          const data = await res.json()
          if (data.token) {
            setSsoToken(data.token)
          }
        } else if (!ssoTokenFromUrl) {
          // No URL token and no long-term cookie → redirect to login
          window.location.href = '/platform-login'
          return
        }
        // If check-login fails but we have a URL token, keep using the URL token
      } catch {
        // Network error — keep whatever we have (URL token or nothing)
      } finally {
        if (!cancelled) setCheckingToken(false)
      }
    }

    ensureToken()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 10-second fallback: if the iframe hasn't loaded within 10s, show an error
  useEffect(() => {
    if (!checkingToken && !iframeLoaded.current && !failed) {
      loadingTimer.current = setTimeout(() => {
        if (!iframeLoaded.current) {
          setFailed(true)
          setLoading(false)
        }
      }, 10_000)
    }
    return () => {
      if (loadingTimer.current) clearTimeout(loadingTimer.current)
    }
  }, [checkingToken, failed])

  const chatBase = getChatBase()

  // Wait until token check is complete before building the iframe URL
  const scoutChatUrl = checkingToken
    ? 'about:blank'
    : ssoToken
      ? `${chatBase}/home.html?sso_token=${encodeURIComponent(ssoToken)}`
      : `${chatBase}/login.html?role=student`

  return (
    <main style={{ minHeight: '100vh', background: '#f8f7ff', position: 'relative' }}>
      {loading && !failed && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 2, display: 'grid', placeItems: 'center',
          color: '#4a3f7a', fontSize: 18, background: '#f8f7ff',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: 12 }}>
              正在进入 AI 伯乐·探索空间…
            </div>
            {checkingToken && (
              <div style={{ fontSize: 14, color: '#8a83a6' }}>
                验证登录状态…
              </div>
            )}
          </div>
        </div>
      )}
      {failed && (
        <section style={{ maxWidth: 620, margin: '0 auto', padding: '96px 24px', color: '#4a3f7a', lineHeight: 1.8 }}>
          <h1 style={{ color: '#6b5bb0' }}>AI 伯乐·探索空间服务暂未启动</h1>
          <p>请先在 "AI-talent scout" 文件夹启动 Node.js 服务：</p>
          <pre style={{ padding: 14, borderRadius: 12, background: '#fff', overflow: 'auto' }}>node server.js</pre>
          <p>服务启动后，刷新本页即可进入探索空间。</p>
          <p style={{ marginTop: 16, fontSize: 14, color: '#8a83a6' }}>
            如已启动但仍出现此提示，请检查
            <code style={{ background: '#ece9f7', padding: '2px 6px', borderRadius: 4 }}>
              {getChatBase()}
            </code>
            &nbsp;是否可达。
          </p>
        </section>
      )}
      {!checkingToken && (
        <iframe
          title="AI伯乐·探索空间"
          src={scoutChatUrl}
          onLoad={() => {
            iframeLoaded.current = true
            if (loadingTimer.current) clearTimeout(loadingTimer.current)
            setLoading(false)
          }}
          onError={() => { setLoading(false); setFailed(true) }}
          style={{ width: '100%', minHeight: '100vh', border: 0, display: failed ? 'none' : 'block' }}
        />
      )}
    </main>
  )
}

export default ChatObserve
