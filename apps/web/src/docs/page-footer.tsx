import { usePathname } from 'fumadocs-core/framework'
import Link from 'fumadocs-core/link'
import { findNeighbour } from 'fumadocs-core/page-tree'
import { useTreeContext } from 'fumadocs-ui/contexts/tree'
import { ArrowLeft, ArrowRight } from 'lucide-react'

export const DocsPageFooter = () => {
  const { full } = useTreeContext()
  const { next, previous } = findNeighbour(full, usePathname())

  if (!(next || previous)) return null

  return (
    <nav
      aria-label="Previous and next page"
      className="mt-10 flex flex-col gap-4"
    >
      {next && (
        <Link
          className="group border-fd-primary/20 bg-fd-primary/5 hover:bg-fd-primary/10 flex items-center justify-between gap-6 rounded-2xl border p-5 transition-colors md:p-6"
          href={next.url}
        >
          <span className="flex min-w-0 flex-col gap-1">
            <span className="text-fd-primary text-sm font-medium">Next up</span>
            <span className="text-fd-foreground text-lg font-semibold text-balance">
              {next.name}
            </span>
            {next.description && (
              <span className="text-fd-muted-foreground text-sm leading-relaxed text-pretty">
                {next.description}
              </span>
            )}
          </span>
          <ArrowRight
            aria-hidden="true"
            className="text-fd-primary size-5 shrink-0 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
          />
        </Link>
      )}
      {previous && (
        <Link
          className="text-fd-muted-foreground hover:text-fd-foreground inline-flex items-center gap-2 self-start py-2 text-sm transition-colors"
          href={previous.url}
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {previous.name}
        </Link>
      )}
    </nav>
  )
}
