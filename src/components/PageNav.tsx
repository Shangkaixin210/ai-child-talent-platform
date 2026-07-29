import { NavLink } from 'react-router-dom'

const pages = [
  { path: '/login', label: '登录页' },
  { path: '/chat-observe', label: '自然聊天观察' },
  { path: '/story-create', label: '故事共创任务' },
  { path: '/campus-design', label: '未来校园设计' },
  { path: '/career-sim', label: '职业体验模拟器' },
  { path: '/report', label: '天赋报告汇总' },
]

function PageNav() {
  return (
    <nav className="page-nav" aria-label="页面导航">
      {pages.map((page) => (
        <NavLink key={page.path} to={page.path}>
          {page.label}
        </NavLink>
      ))}
    </nav>
  )
}

export default PageNav
