import { Card } from '@vitnode/core/components/ui/card'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@vitnode/core/components/ui/pagination'
import React from 'react'

const TOTAL_PAGES = 12
const PER_PAGE = 3

const TOPICS = [
  'Why my plugin works on my machine',
  'Naming things, part 47',
  'A love letter to dark mode',
  'Migrations I regret',
  'Tabs vs spaces: the sequel',
  'Coffee-driven development',
]

type PageSlot = 'ellipsis-end' | 'ellipsis-start' | number

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, step) => from + step)

const pageWindow = (current: number, total: number): PageSlot[] => {
  if (total <= 5) return range(1, total)
  if (current <= 3) return [1, 2, 3, 'ellipsis-end', total]
  if (current >= total - 2) {
    return [1, 'ellipsis-start', ...range(total - 2, total)]
  }

  return [1, 'ellipsis-start', current, 'ellipsis-end', total]
}

const postsFor = (page: number) =>
  range((page - 1) * PER_PAGE + 1, page * PER_PAGE).map((id) => ({
    id,
    title: TOPICS[(id - 1) % TOPICS.length],
  }))

export default function PaginationExample() {
  const [page, setPage] = React.useState(1)

  const goTo =
    (nextPage: number) => (event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault()
      setPage(nextPage)
    }

  const stepProps = (nextPage: number, enabled: boolean) =>
    enabled
      ? { href: '#', onClick: goTo(nextPage) }
      : {
          'aria-disabled': true as const,
          className: 'pointer-events-none',
          role: 'link',
        }

  return (
    <Card className="not-prose w-full px-4 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-foreground text-base font-medium">Latest posts</h3>
        <p
          aria-live="polite"
          className="text-muted-foreground text-sm tabular-nums"
        >
          {(page - 1) * PER_PAGE + 1}-{page * PER_PAGE} of{' '}
          {TOTAL_PAGES * PER_PAGE}
        </p>
      </div>

      <ul className="flex flex-col divide-y">
        {postsFor(page).map((post) => (
          <li className="flex items-center gap-3 py-3" key={post.id}>
            <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-medium tabular-nums">
              #{post.id}
            </span>
            <span className="text-foreground truncate text-sm leading-relaxed">
              {post.title}
            </span>
          </li>
        ))}
      </ul>

      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious {...stepProps(page - 1, page > 1)} />
          </PaginationItem>

          <PaginationItem className="sm:hidden">
            <span className="text-muted-foreground px-2 text-sm tabular-nums">
              Page {page} of {TOTAL_PAGES}
            </span>
          </PaginationItem>

          {pageWindow(page, TOTAL_PAGES).map((slot) => (
            <PaginationItem className="hidden sm:block" key={slot}>
              {typeof slot === 'number' ? (
                <PaginationLink
                  href="#"
                  isActive={slot === page}
                  onClick={goTo(slot)}
                >
                  {slot}
                </PaginationLink>
              ) : (
                <PaginationEllipsis />
              )}
            </PaginationItem>
          ))}

          <PaginationItem>
            <PaginationNext {...stepProps(page + 1, page < TOTAL_PAGES)} />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </Card>
  )
}
