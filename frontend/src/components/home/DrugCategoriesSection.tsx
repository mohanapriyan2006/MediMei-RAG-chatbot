import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Card } from '../common/Card'
import { drugCategories } from './homeData'

export function DrugCategoriesSection() {
  return (
    <section className="px-5 py-16 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-accent mb-2">
              Comprehensive Coverage
            </p>
            <h2 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">
              Explore Drug Label Categories
            </h2>
          </div>
          <Link
            to="/documents"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-accent transition-colors"
          >
            <span>View Full Drug Library</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {drugCategories.map((cat) => {
            const IconComponent = cat.icon
            return (
              <Card key={cat.title} hover variant="default" className="flex flex-col justify-between gap-4">
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-highlight text-primary border border-border">
                      <IconComponent className="h-5 w-5" />
                    </div>
                    <span className="rounded-pill bg-surface-warm border border-border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-fg-muted">
                      {cat.badge}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-fg">{cat.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-fg-secondary">
                    {cat.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-border">
                  <Link
                    to={`/chat?category=${encodeURIComponent(cat.title)}`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-accent transition-colors"
                  >
                    <span>Query {cat.title}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}
