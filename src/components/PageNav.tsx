import { NavLink } from 'react-router-dom'

const pages = [
  { path: '/login', label: '探索首页' },
  { path: '/chat-observe', label: '自然聊天' },
  { path: '/story-create', label: '故事共创' },
  { path: '/campus-design', label: '深海基地重建' },
  { path: '/career-sim', label: '职业体验' },
  { path: '/report', label: '成长报告' },
]

function PageNav() {
  return (
    <nav className="page-nav" aria-label="模块导航">
      {pages.map((page) => (
        <NavLink key={page.path} to={page.path}>
          {page.label}
        </NavLink>
      ))}
    </nav>
  )
}

export default PageNav
