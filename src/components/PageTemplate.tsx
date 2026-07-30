import type { ReactNode } from 'react'
import PageNav from './PageNav'

interface PageTemplateProps {
  title: string
  description?: string
  children?: ReactNode
}

function PageTemplate({ title, description, children }: PageTemplateProps) {
  return (
    <main className="page">
      <div className="page__orb page__orb--one" />
      <div className="page__orb page__orb--two" />
      <section className="page__content">
        <span className="page__kicker">星芽成长 · 潜能探索</span>
        <h1 className="page__title">{title}</h1>
        {description && <p className="page__description">{description}</p>}
        {children || (
          <div className="page__notice">
            <span aria-hidden="true">✦</span>
            <div>
              <strong>这个探索空间正在准备中</strong>
              <p>更多有趣的成长任务很快就会和你见面。</p>
            </div>
          </div>
        )}
        <PageNav />
      </section>
    </main>
  )
}

export default PageTemplate
