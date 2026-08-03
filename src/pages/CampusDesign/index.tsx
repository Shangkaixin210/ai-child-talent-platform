import { Link, useSearchParams } from 'react-router-dom'
import './style.css'

function CampusDesign() {
  const [searchParams] = useSearchParams()
  const ssoToken = searchParams.get('sso_token')

  // 总平台跳转时会带上短期 sso_token，把它传给 iframe 内的深海基地模块用于身份识别；
  // 无 token（直接访问）时不带参数，深海基地内部会显示"请从总平台进入"引导页。
  const gameSrc = ssoToken
    ? `/deep-sea/index.html?sso_token=${encodeURIComponent(ssoToken)}`
    : '/deep-sea/index.html'

  return (
    <main className="campus-design">
      <header className="campus-design__bar">
        <Link className="campus-design__back" to="/login" aria-label="返回平台首页">
          <span aria-hidden="true">←</span>
          返回平台
        </Link>
        <div className="campus-design__title">
          <span className="campus-design__eyebrow">深海基地重建</span>
          <strong>蔚蓝深海基地</strong>
        </div>
        <span className="campus-design__status">
          <i aria-hidden="true" />
          探索任务
        </span>
      </header>

      <iframe
        className="campus-design__game"
        src={gameSrc}
        title="蔚蓝深海基地创建游戏"
        allow="microphone; autoplay"
      />
    </main>
  )
}

export default CampusDesign
