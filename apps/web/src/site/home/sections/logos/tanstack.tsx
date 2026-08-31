/**
 * TanStack, as a wordmark rather than as a logo.
 *
 * There is no TanStack brand asset in this repository, and Stage 15 is not the
 * place to acquire one - a third-party mark that nobody checked in is a licence
 * question and a review question, not a migration one. The row it sits in
 * already renders two of its entries as a mark plus a word (`Hono`,
 * `PostgreSQL`), so a word on its own is the same visual language with the mark
 * left out, and it is honest about what it is.
 *
 * The three products are named because that is what VitNode actually uses:
 * Start renders the document, Router owns the route tree and the locale rewrite,
 * and Query owns every cache the loaders warm.
 */
export const TanStackLogo = () => (
  <span className="flex flex-col items-center leading-tight">
    <span className="text-xl font-bold">TanStack</span>
    <span className="text-muted-foreground text-xs">
      Start · Router · Query
    </span>
  </span>
)
