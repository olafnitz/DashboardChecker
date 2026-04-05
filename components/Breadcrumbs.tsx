import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

interface BreadcrumbItem {
  label: string
  href?: string
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
        {items.map((item, index) => {
          const isLast = index === items.length - 1

          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-2">
              {index > 0 && <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden />}
              {item.href && !isLast ? (
                <Link href={item.href} className="focus-ring rounded-[6px] hover:text-[#4F46E5]">
                  {item.label}
                </Link>
              ) : (
                <span className={isLast ? 'font-semibold text-slate-700' : ''}>{item.label}</span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
