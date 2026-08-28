/**
 * The main application shell, as a document structure and nothing else.
 *
 * Four slots and one `<main>`. Everything that decides *what* goes in a slot -
 * reading the session, subscribing to a WebSocket, resolving a breadcrumb from
 * the router - is the framework's business and stays in the framework's half:
 * `layout.tsx` fills these slots from Server Components, `apps/web`'s `_main`
 * route fills them from its router. What both of them get from here is the same
 * element order and the same semantic `<main>`, so the two runtimes cannot
 * quietly drift into different documents.
 *
 * It imports nothing. That is deliberate rather than incidental: the moment this
 * reaches for `@/lib/navigation`, `next-intl/server` or a `"use server"` module
 * it stops being renderable outside Next.js, which is the failure
 * `theme-boundaries.test.ts` exists to catch.
 *
 * ## Why `<main>` is here rather than in each page
 *
 * There is exactly one `<main>` per document, and a page that renders its own
 * inside a shell that also renders one produces two - invalid HTML, and a
 * screen reader that now has two "main" landmarks to choose from. The shell owns
 * the landmark; a page owns its width, its padding and its vertical rhythm, in
 * whatever container it likes.
 */
export const ThemeLayoutContent = ({
  breadcrumb,
  children,
  header,
  listeners,
}: {
  /** Rendered between the header and `<main>`, or nothing. */
  breadcrumb?: React.ReactNode;
  children: React.ReactNode;
  /** The site header. A slot, because its contents are framework-bound. */
  header?: React.ReactNode;
  /**
   * Components that render nothing and only subscribe - notification toasts,
   * the WebSocket's sign-in/sign-out resync. First in the tree so they are
   * mounted before anything that can produce an event for them.
   */
  listeners?: React.ReactNode;
}) => (
  <>
    {listeners}
    {header}
    {breadcrumb}
    <main>{children}</main>
  </>
);
