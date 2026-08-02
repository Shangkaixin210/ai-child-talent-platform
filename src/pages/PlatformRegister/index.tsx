import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

function PlatformRegister() {
  const navigate = useNavigate()
  const [platformUid, setPlatformUid] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleRegister(e: FormEvent) {
    e.preventDefault()
    const uid = platformUid.trim()
    const name = username.trim()

    if (!uid) { setError('请输入学号'); return }
    if (!/^S\d{7}$/.test(uid)) { setError('学号格式不正确，应为 S 加7位数字，例如 S2024001'); return }
    if (!name) { setError('请输入用户名'); return }
    if (!password || password.length < 8 || !/(?=.*[A-Za-z])(?=.*\d)/.test(password)) { setError('密码至少需要8位，且需包含字母和数字'); return }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/platform/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platformUid: uid, username: name, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '注册失败，请重试')
        return
      }

      // Register success — go to login page
      navigate('/platform-login')
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
            background: 'linear-gradient(135deg, #5bc0d4, #48c9a0)',
            color: '#fff',
            fontSize: 26,
            marginBottom: 16,
          }} aria-hidden="true">✦</span>
          <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 700, color: '#2e2256' }}>
            注册账号
          </h2>
          <p style={{ margin: 0, fontSize: 14, color: '#8a83a6' }}>
            创建一个新账号，即可开始探索
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleRegister}>
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
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#a9a2c8' }}>格式：S + 7位数字，例如 S2024001</p>

          <label
            htmlFor="username"
            style={{ display: 'block', marginTop: 16, marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#5a5290' }}
          >
            用户名
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => { setUsername(e.target.value); setError('') }}
            placeholder="你的名字或昵称"
            style={inputStyle(!!error && !username.trim())}
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
            placeholder="至少8位，需包含字母和数字"
            style={inputStyle(!!error && (!password || password.length < 8 || !/(?=.*[A-Za-z])(?=.*\d)/.test(password)))}
          />
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#a9a2c8' }}>至少8位，需包含字母和数字</p>

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
                : 'linear-gradient(135deg, #5bc0d4, #48c9a0)',
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
            {loading ? '注册中…' : '注册'}
          </button>
        </form>

        <p style={{ margin: '20px 0 0', fontSize: 14, color: '#8a83a6', textAlign: 'center' }}>
          已有账号？
          {' '}
          <Link to="/platform-login" style={{ color: '#7c6aef', fontWeight: 600, textDecoration: 'none' }}>
            去登录
          </Link>
        </p>
      </div>
    </main>
  )
}

export default PlatformRegister
