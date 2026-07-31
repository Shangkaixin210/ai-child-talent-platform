import { Link } from 'react-router-dom'

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
  {
    path: '/scout',
    number: '05',
    icon: '✦',
    title: 'AI伯乐·探索空间',
    description: '和 AI 伯乐自由聊天，在真实对话中发现孩子的独特潜能与天赋方向。',
    action: '进入探索空间',
    tone: 'indigo',
    featured: true,
  },
]

function Login() {
  return (
    <main className="home">
      <div className="home__glow home__glow--one" />
      <div className="home__glow home__glow--two" />

      <header className="home__header">
        <Link className="brand" to="/" aria-label="星芽成长首页">
          <span className="brand__mark" aria-hidden="true">✦</span>
          <span>
            <strong>星芽成长</strong>
            <small>AI CHILD TALENT LAB</small>
          </span>
        </Link>
        <Link className="report-link" to="/report">
          <span aria-hidden="true">▥</span>
          成长报告
        </Link>
      </header>

      <section className="home__hero">
        <div className="home__intro">
          <span className="home__badge"><i /> AI 多元潜能探索平台</span>
          <h1>
            每个孩子，都是一颗
            <em>独一无二的星星</em>
          </h1>
          <p>
            通过故事、游戏和真实情境，让孩子自在探索。我们用 AI 记录成长轨迹，
            帮助家长看见兴趣背后的潜能。
          </p>
          <div className="home__facts" aria-label="平台特点">
            <span><b>4</b> 大探索场景</span>
            <span><b>8+</b> 潜能维度</span>
            <span><b>1</b> 份成长画像</span>
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

        <div className="module-grid">
          {modules.map((module) => (
            <Link
              className={`module-card module-card--${module.tone}${module.featured ? ' module-card--featured' : ''}`}
              to={module.path}
              key={module.path}
            >
              <div className="module-card__top">
                <span className="module-card__icon" aria-hidden="true">{module.icon}</span>
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
      </section>

      <footer className="home__footer">
        <span>星芽成长 · 尊重每一种成长节奏</span>
        <span>探索过程仅用于成长支持，不作为能力定论</span>
      </footer>
    </main>
  )
}

export default Login
