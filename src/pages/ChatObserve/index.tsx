import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

// AI伯乐·探索空间 聊天模块（独立 Express 进程，端口 3000）
// 仅开放学生端入口，教师端不可从此处访问
const NGROK_URL = 'https://activity-postcard-anyone.ngrok-free.dev/login.html?role=student'

function ChatObserve() {
  const [searchParams] = useSearchParams()
  const ssoToken = searchParams.get('sso_token')
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  // 有 sso_token 时使用本地聊天服务地址，否则回退到 ngrok
  const scoutChatUrl = ssoToken
    ? `http://localhost:3000/home.html?sso_token=${encodeURIComponent(ssoToken)}`
    : NGROK_URL

  return (
    <main style={{ minHeight: '100vh', background: '#f8f7ff', position: 'relative' }}>
      {loading && !failed && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 2, display: 'grid', placeItems: 'center',
          color: '#4a3f7a', fontSize: 18, background: '#f8f7ff',
        }}>
          正在进入 AI 伯乐·探索空间…
        </div>
      )}
      {failed && (
        <section style={{ maxWidth: 620, margin: '0 auto', padding: '96px 24px', color: '#4a3f7a', lineHeight: 1.8 }}>
          <h1 style={{ color: '#6b5bb0' }}>AI 伯乐·探索空间服务暂未启动</h1>
          <p>请先在 "AI-talent scout" 文件夹启动 Node.js 服务：</p>
          <pre style={{ padding: 14, borderRadius: 12, background: '#fff', overflow: 'auto' }}>node server.js</pre>
          <p>服务启动后，刷新本页即可进入探索空间。</p>
        </section>
      )}
      <iframe
        title="AI伯乐·探索空间"
        src={scoutChatUrl}
        onLoad={() => setLoading(false)}
        onError={() => { setLoading(false); setFailed(true) }}
        style={{ width: '100%', minHeight: '100vh', border: 0, display: failed ? 'none' : 'block' }}
      />
    </main>
  )
}

export default ChatObserve
