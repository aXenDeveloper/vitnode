import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@vitnode/core/components/ui/pagination'

export default function PaginationLabelsExample() {
  return (
    <Pagination className="not-prose">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            aria-disabled
            aria-label="Newer posts"
            className="pointer-events-none"
            role="link"
            text="Newer posts"
          />
        </PaginationItem>
        <PaginationItem>
          <PaginationNext
            aria-label="Older posts"
            href="#"
            onClick={(event) => {
              event.preventDefault()
            }}
            text="Older posts"
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
