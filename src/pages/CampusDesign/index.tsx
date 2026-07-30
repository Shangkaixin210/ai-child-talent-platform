import { Link } from 'react-router-dom'
import './style.css'

function CampusDesign() {
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
        src="/deep-sea/index.html"
        title="蔚蓝深海基地创建游戏"
        allow="microphone; autoplay"
      />
    </main>
  )
}

export default CampusDesign
