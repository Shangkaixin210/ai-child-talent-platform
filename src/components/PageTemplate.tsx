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
      <section className="page__content">
        <h1 className="page__title">{title}</h1>
        {description && <p className="page__description">{description}</p>}
        {children}
        <PageNav />
      </section>
    </main>
  )
}

export default PageTemplate
