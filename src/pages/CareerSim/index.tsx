import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

// 职业体验保持独立运行在 8005；总平台只负责统一入口和身份传递。
const careerAppUrl = import.meta.env.VITE_CAREER_SIM_URL
  || `${window.location.protocol}//${window.location.hostname}:8005/`

function CareerSim() {
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const iframeUrl = useMemo(() => {
    const token = searchParams.get('sso_token')
    if (!token) return careerAppUrl
    const join = careerAppUrl.includes('?') ? '&' : '?'
    return `${careerAppUrl}${join}sso_token=${encodeURIComponent(token)}`
  }, [searchParams])

  return (
    <main style={{ minHeight: '100vh', background: '#fff9ee', position: 'relative' }}>
      {loading && !failed && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 2, display: 'grid', placeItems: 'center',
          color: '#7d5b42', fontSize: 18, background: '#fff9ee',
        }}>
          正在进入职业体验小岛…
        </div>
      )}
      {failed && (
        <section style={{ maxWidth: 620, margin: '0 auto', padding: '96px 24px', color: '#5e493a', lineHeight: 1.8 }}>
          <h1 style={{ color: '#b86b45' }}>职业体验服务暂未启动</h1>
          <p>请先在“职业体验模拟器”文件夹启动 FastAPI 服务：</p>
          <pre style={{ padding: 14, borderRadius: 12, background: '#fff', overflow: 'auto' }}>uvicorn main:app --host 0.0.0.0 --port 8005</pre>
          <p>服务启动后，刷新本页即可进入体验。</p>
        </section>
      )}
      <iframe
        title="职业体验模拟器"
        src={iframeUrl}
        onLoad={() => setLoading(false)}
        onError={() => { setLoading(false); setFailed(true) }}
        style={{ width: '100%', minHeight: '100vh', border: 0, display: failed ? 'none' : 'block' }}
      />
    </main>
  )
}

export default CareerSim
