import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

const modules = [
  {
    path: '/chat-observe',
    number: '01',
    icon: '✦',
    title: '自然聊天观察',
    description: '在轻松对话中发现孩子的表达方式、好奇心与思考习惯。',
    action: '开始对话',
    tone: 'violet',
  },
  {
    path: '/story-create',
    number: '02',
    icon: '✎',
    title: '故事共创',
    description: '和 AI 一起创造专属故事，让想象力在每次选择中自然生长。',
    action: '创作故事',
    tone: 'orange',
  },
  {
    path: '/campus-design',
    number: '03',
    icon: '≈',
    title: '深海基地重建',
    description: '进入蔚蓝深海基地，通过建造、协作和挑战探索多元潜能。',
    action: '进入深海基地',
    tone: 'cyan',
    featured: true,
  },
  {
    path: '/career-sim',
    number: '04',
    icon: '◇',
    title: '职业体验',
    description: '在真实感任务中体验不同职业，发现兴趣背后的能力线索。',
    action: '选择职业',
    tone: 'green',
  },
]

// Decode a JWT payload client-side (no verification — for display only).
// Verification is done by the backend when the token is actually used.
//
// IMPORTANT: JWT uses base64url of the UTF-8 JSON payload.  `atob()` decodes
// byte-by-byte into a Latin-1 binary string — ASCII survives, but multi-byte
// UTF-8 characters (e.g. Chinese) are split into individual Latin-1 codepoints,
// producing mojibake.  We must decode via TextDecoder to recover the original
// UTF-8 text.
function decodeJwtPayload(token: string): { platformUid: string; username: string } | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    // atob → binary Latin-1 string → Uint8Array → TextDecoder(UTF-8)
    const binary = atob(base64)
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    const json = new TextDecoder().decode(bytes)
    const decoded = JSON.parse(json)
    if (decoded.platformUid && decoded.username) {
      return { platformUid: decoded.platformUid, username: decoded.username }
    }
    return null
  } catch {
    return null
  }
}

function Login() {
  const [searchParams] = useSearchParams()
  const ssoTokenFromUrl = searchParams.get('sso_token')

  // ssoToken used for module-card links — starts with the URL token,
  // falls back to a fresh token from /check-login when the user returns
  // via long-term cookie.
  const [ssoToken, setSsoToken] = useState<string | null>(ssoTokenFromUrl)
  const [loggingOut, setLoggingOut] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [userInfo, setUserInfo] = useState<{ platformUid: string; username: string } | null>(null)
  const [checkingLogin, setCheckingLogin] = useState(true)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // On mount: if a URL token is present, decode it immediately for display.
  // Also call /check-login to validate the long-term cookie — this covers
  // the case where the user returns to /login directly (no URL token) but
  // still has a valid platform_login cookie.
  useEffect(() => {
    // Immediate decode from URL token (fast path)
    if (ssoTokenFromUrl) {
      const decoded = decodeJwtPayload(ssoTokenFromUrl)
      if (decoded) {
        setUserInfo({ platformUid: decoded.platformUid, username: decoded.username })
      }
    }

    let cancelled = false
    async function checkLogin() {
      try {
        const res = await fetch('/api/platform/check-login', {
          credentials: 'include',
        })
        if (cancelled) return
        if (res.ok) {
          const data = await res.json()
          const decoded = decodeJwtPayload(data.token)
          if (decoded) {
            setUserInfo({ platformUid: decoded.platformUid, username: decoded.username })
            // Use the fresh token for module links only when there's no URL token
            if (!ssoTokenFromUrl) {
              setSsoToken(data.token)
            }
          }
        } else {
          // Cookie invalid/missing — only clear if we didn't get info from URL
          if (!ssoTokenFromUrl) {
            setUserInfo(null)
          }
        }
      } catch {
        // Network error — keep whatever state we have
      } finally {
        if (!cancelled) setCheckingLogin(false)
      }
    }
    checkLogin()
    return () => {
      cancelled = true
    }
  }, []) // Run once on mount; URL params don't change on this page

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    if (showDropdown) {
      document.addEventListener('mousedown', handleClick)
    }
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showDropdown])

  // Append SSO token to a path if available; redirect to login when not authenticated
  const withToken = (path: string) =>
    ssoToken ? `${path}?sso_token=${encodeURIComponent(ssoToken)}` : '/platform-login'

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await fetch('/api/platform/logout', { method: 'POST', credentials: 'include' })
    } catch {
      // Even if the request fails, proceed with redirect
    }
    window.location.href = '/platform-login'
  }

  const isLoggedIn = !!userInfo
  const avatarLetter = userInfo?.username?.charAt(0)?.toUpperCase() || '?'

  // ── shared inline style fragments ──────────────────────────────────

  const dropdownPanelStyle: React.CSSProperties = {
    position: 'absolute',
    top: 'calc(100% + 10px)',
    right: 0,
    minWidth: 268,
    padding: '24px',
    borderRadius: 20,
    background: 'rgba(255,255,255,0.88)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    boxShadow: '0 20px 56px rgba(54,46,98,0.13), 0 4px 12px rgba(0,0,0,0.05)',
    border: '1px solid rgba(124,106,239,0.11)',
    zIndex: 100,
  }

  const menuItemBase: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    transition: 'background 150ms ease',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textDecoration: 'none',
  }

  return (
    <main className="home">
      <div className="home__glow home__glow--one" />
      <div className="home__glow home__glow--two" />

      <header className="home__header">
        <Link className="brand" to="/" aria-label="星芽成长首页">
          <span className="brand__mark" aria-hidden="true">
            ✦
          </span>
          <span>
            <strong>星芽成长</strong>
            <small>AI CHILD TALENT LAB</small>
          </span>
        </Link>

        {/* ── Personal Center ── */}
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          {/* Trigger button — same pill/capsule style as the original .report-link */}
          <button
            onClick={() => setShowDropdown((v) => !v)}
            aria-expanded={showDropdown}
            aria-haspopup="true"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 18px 8px 8px',
              color: '#4d5a71',
              border: '1px solid rgba(96,112,137,0.18)',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.72)',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 5px 18px rgba(54,78,104,0.06)',
              transition: 'transform 160ms ease, box-shadow 160ms ease',
              fontFamily: 'inherit',
              lineHeight: 1,
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.transform =
                'translateY(-2px)'
              ;(e.currentTarget as HTMLButtonElement).style.boxShadow =
                '0 9px 24px rgba(54,78,104,0.12)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.transform = ''
              ;(e.currentTarget as HTMLButtonElement).style.boxShadow =
                '0 5px 18px rgba(54,78,104,0.06)'
            }}
          >
            {/* Avatar circle */}
            <span
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: isLoggedIn
                  ? 'linear-gradient(135deg, #7c6aef, #48b5c8)'
                  : '#d8d4ec',
                color: '#fff',
                fontSize: 15,
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              {checkingLogin ? '…' : isLoggedIn ? avatarLetter : '?'}
            </span>
            <span style={{ color: '#2e2256' }}>
              {checkingLogin ? '…' : isLoggedIn ? userInfo!.username : '未登录'}
            </span>
            <span
              style={{
                display: 'inline-block',
                fontSize: 10,
                marginLeft: -2,
                transform: showDropdown ? 'rotate(180deg)' : '',
                transition: 'transform 200ms ease',
                color: '#8a83a6',
              }}
            >
              ▼
            </span>
          </button>

          {/* ── Dropdown panel ── */}
          {showDropdown && (
            <div style={dropdownPanelStyle}>
              {isLoggedIn ? (
                <>
                  {/* User info header */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      marginBottom: 20,
                    }}
                  >
                    <span
                      style={{
                        display: 'grid',
                        placeItems: 'center',
                        width: 48,
                        height: 48,
                        borderRadius: 16,
                        background: 'linear-gradient(135deg, #7c6aef, #48b5c8)',
                        color: '#fff',
                        fontSize: 22,
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      {avatarLetter}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 16,
                          fontWeight: 700,
                          color: '#2e2256',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {userInfo!.username}
                      </div>
                      <div style={{ fontSize: 12, color: '#8a83a6', marginTop: 2 }}>
                        学号：{userInfo!.platformUid}
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div
                    style={{
                      height: 1,
                      background: 'rgba(124,106,239,0.1)',
                      margin: '0 -4px 12px',
                    }}
                  />

                  {/* Menu: 成长报告 (placeholder entry) */}
                  <Link
                    to="/report"
                    onClick={() => setShowDropdown(false)}
                    style={{ ...menuItemBase, color: '#4d5a71' }}
                    onMouseEnter={(e) => {
                      ;(e.currentTarget as HTMLAnchorElement).style.background =
                        'rgba(124,106,239,0.06)'
                    }}
                    onMouseLeave={(e) => {
                      ;(e.currentTarget as HTMLAnchorElement).style.background = ''
                    }}
                  >
                    <span style={{ fontSize: 16 }}>▥</span>
                    成长报告
                  </Link>

                  {/* Menu: 退出登录 */}
                  <button
                    onClick={handleLogout}
                    disabled={loggingOut}
                    style={{
                      ...menuItemBase,
                      color: '#d15263',
                      width: '100%',
                      border: 'none',
                      background: 'transparent',
                      marginTop: 4,
                      cursor: loggingOut ? 'not-allowed' : 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      ;(e.currentTarget as HTMLButtonElement).style.background =
                        'rgba(209,82,99,0.06)'
                    }}
                    onMouseLeave={(e) => {
                      ;(e.currentTarget as HTMLButtonElement).style.background = ''
                    }}
                  >
                    <span style={{ fontSize: 16 }}>↪</span>
                    {loggingOut ? '退出中…' : '退出登录'}
                  </button>
                </>
              ) : (
                <>
                  {/* Not-logged-in state */}
                  <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
                    <span
                      style={{
                        display: 'inline-grid',
                        placeItems: 'center',
                        width: 48,
                        height: 48,
                        borderRadius: 16,
                        background: '#ece9f7',
                        color: '#8a83a6',
                        fontSize: 22,
                        marginBottom: 12,
                      }}
                    >
                      ?
                    </span>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: '#2e2256',
                        marginBottom: 4,
                      }}
                    >
                      未登录
                    </div>
                    <div style={{ fontSize: 12, color: '#8a83a6' }}>
                      登录后可进入四大探索模块
                    </div>
                  </div>
                  <Link
                    to="/platform-login"
                    onClick={() => setShowDropdown(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '11px 0',
                      borderRadius: 12,
                      border: 'none',
                      background: 'linear-gradient(135deg, #7c6aef, #48b5c8)',
                      color: '#fff',
                      fontSize: 15,
                      fontWeight: 600,
                      textDecoration: 'none',
                      boxSizing: 'border-box',
                    }}
                  >
                    <span>✦</span>
                    去登录
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      <section className="home__hero">
        <div className="home__intro">
          <span className="home__badge">
            <i /> AI 多元潜能探索平台
          </span>
          <h1>
            每个孩子，都是一颗
            <em>独一无二的星星</em>
          </h1>
          <p>
            通过故事、游戏和真实情境，让孩子自在探索。我们用 AI 记录成长轨迹，
            帮助家长看见兴趣背后的潜能。
          </p>
          <div className="home__facts" aria-label="平台特点">
            <span>
              <b>4</b> 大探索场景
            </span>
            <span>
              <b>8+</b> 潜能维度
            </span>
            <span>
              <b>1</b> 份成长画像
            </span>
          </div>
        </div>

        <div className="orbit" aria-hidden="true">
          <div className="orbit__ring orbit__ring--outer" />
          <div className="orbit__ring orbit__ring--inner" />
          <span className="orbit__planet orbit__planet--one">✎</span>
          <span className="orbit__planet orbit__planet--two">≈</span>
          <span className="orbit__planet orbit__planet--three">◇</span>
          <div className="orbit__core">
            <span>✦</span>
            <strong>发现</strong>
            <small>孩子的闪光点</small>
          </div>
        </div>
      </section>

      <section className="explore">
        <div className="section-heading">
          <div>
            <span>EXPLORE &amp; GROW</span>
            <h2>选择今天的探索</h2>
          </div>
          <p>没有标准答案，只有属于孩子自己的成长路径</p>
        </div>

        {checkingLogin ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#8a83a6', fontSize: 16 }}>
            正在验证登录状态…
          </div>
        ) : (
          <div className="module-grid">
            {modules.map((module) => (
              <Link
                className={`module-card module-card--${module.tone}${module.featured ? ' module-card--featured' : ''}`}
                to={withToken(module.path)}
                key={module.path}
              >
                <div className="module-card__top">
                  <span className="module-card__icon" aria-hidden="true">
                    {module.icon}
                  </span>
                  <span className="module-card__number">{module.number}</span>
                </div>
                <h3>{module.title}</h3>
                <p>{module.description}</p>
                <span className="module-card__action">
                  {module.action}
                  <b aria-hidden="true">→</b>
                </span>
                {module.featured && <span className="module-card__tag">全新探索</span>}
              </Link>
            ))}
          </div>
        )}
      </section>

      <footer className="home__footer">
        <span>星芽成长 · 尊重每一种成长节奏</span>
        <span>探索过程仅用于成长支持，不作为能力定论</span>
      </footer>
    </main>
  )
}

export default Login
