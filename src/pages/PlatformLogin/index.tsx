import { type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

function PlatformLogin() {
  const navigate = useNavigate()
  const [platformUid, setPlatformUid] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checkingLogin, setCheckingLogin] = useState(true)

  // 页面加载时检查长期登录 Cookie 是否有效
  useEffect(() => {
    let cancelled = false
    async function checkLogin() {
      try {
        const res = await fetch('/api/platform/check-login', {
          credentials: 'include',
        })
        if (cancelled) return
        if (res.ok) {
          const data = await res.json()
          // Cookie 有效 → 直接跳到模块选择页
          navigate(`/login?sso_token=${encodeURIComponent(data.token)}`)
        } else {
          // Cookie 无效 → 显示登录表单
          setCheckingLogin(false)
        }
      } catch {
        // 网络错误也显示登录表单
        if (!cancelled) setCheckingLogin(false)
      }
    }
    checkLogin()
    return () => { cancelled = true }
  }, [navigate])

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    const uid = platformUid.trim()
    if (!uid) {
      setError('请输入学号')
      return
    }
    if (!password) {
      setError('请输入密码')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/platform/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platformUid: uid, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '登录失败，请重试')
        return
      }

      // Login success — redirect to module selection page with SSO token
      navigate(`/login?sso_token=${encodeURIComponent(data.token)}`)
    } catch {
      setError('网络错误，请确认后端服务已启动')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = (hasError: boolean) => ({
    width: '100%',
    boxSizing: 'border-box' as const,
    height: 48,
    padding: '0 16px',
    fontSize: 16,
    borderRadius: 12,
    border: `1.5px solid ${hasError ? '#e0556a' : '#dcd8f0'}`,
    background: '#fff',
    color: '#2e2256',
    outline: 'none',
    transition: 'border-color .2s',
  })

  if (checkingLogin) {
    return (
      <main className="home" style={{ display: 'grid', placeItems: 'center' }}>
        <div className="home__glow home__glow--one" />
        <div className="home__glow home__glow--two" />
        <p style={{ position: 'relative', zIndex: 2, color: '#8a83a6', fontSize: 16 }}>
          检查登录状态…
        </p>
      </main>
    )
  }

  return (
    <main className="home" style={{ display: 'grid', placeItems: 'center' }}>
      <div className="home__glow home__glow--one" />
      <div className="home__glow home__glow--two" />

      <div style={{
        position: 'relative',
        zIndex: 2,
        width: '100%',
        maxWidth: 420,
        padding: '48px 40px',
        borderRadius: 24,
        background: 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 8px 40px rgba(102, 96, 168, 0.10), 0 2px 8px rgba(0,0,0,0.04)',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <span style={{
            display: 'inline-block',
            width: 52,
            height: 52,
            lineHeight: '52px',
            borderRadius: 16,
            background: 'linear-gradient(135deg, #856ff4, #5bc0d4)',
            color: '#fff',
            fontSize: 26,
            marginBottom: 16,
          }} aria-hidden="true">✦</span>
          <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 700, color: '#2e2256' }}>
            统一登录
          </h2>
          <p style={{ margin: 0, fontSize: 14, color: '#8a83a6' }}>
            登录后即可进入四大探索模块
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin}>
          <label
            htmlFor="platformUid"
            style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#5a5290' }}
          >
            学号
          </label>
          <input
            id="platformUid"
            type="text"
            value={platformUid}
            onChange={(e) => { setPlatformUid(e.target.value); setError('') }}
            placeholder="例如：S2024001"
            autoFocus
            style={inputStyle(!!error && !platformUid.trim())}
          />

          <label
            htmlFor="password"
            style={{ display: 'block', marginTop: 16, marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#5a5290' }}
          >
            密码
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError('') }}
            placeholder="输入密码"
            style={inputStyle(!!error && !password)}
          />

          {error && (
            <p style={{ margin: '8px 0 0', fontSize: 13, color: '#d15263' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              height: 48,
              marginTop: 20,
              borderRadius: 12,
              border: 0,
              background: loading
                ? '#b8b0d8'
                : 'linear-gradient(135deg, #7c6aef, #48b5c8)',
              color: '#fff',
              fontSize: 16,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'opacity .2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {loading ? '登录中…' : '登录'}
          </button>
        </form>

        <p style={{ margin: '20px 0 0', fontSize: 14, color: '#8a83a6', textAlign: 'center' }}>
          没有账号？
          {' '}
          <Link to="/platform-register" style={{ color: '#7c6aef', fontWeight: 600, textDecoration: 'none' }}>
            去注册
          </Link>
        </p>

        <p style={{
          margin: '16px 0 0',
          fontSize: 12,
          color: '#b0a8cc',
          textAlign: 'center',
        }}>
          Token 有效期 5 分钟
        </p>
      </div>
    </main>
  )
}

export default PlatformLogin
