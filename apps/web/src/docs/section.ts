/**
 * Which top-level section of the documentation a URL is in - `dev`, `ui`,
 * `guides` - or `undefined` for `/docs` itself.
 *
 * It exists for one thing: the accent colour. Each section paints
 * `--color-fd-primary` from its own token (`src/styles.css`), so the sidebar,
 * the active tab and every link inside a document are orange under `dev`, teal
 * under `ui` and blue under `guides`.
 *
 * ## Why this is a pure function of the pathname
 *
 * The Next.js application could not do it this way. Reading the slug there meant
 * reading `params` inside the layout, which would have made the whole docs shell
 * dynamic - so it painted the class onto `<html>` from an inline script derived
 * from `location.pathname`, plus a `useLayoutEffect` to keep it in step. Two
 * mechanisms, a `useServerInsertedHTML` call and a comment explaining why a
 * `<script>` was being smuggled past React.
 *
 * Here the shell is an ordinary component with the router's location in hand, so
 * the class goes on the docs wrapper element and is correct in the first byte of
 * SSR. No script, no effect, no flash, and `<html>` is left alone - which also
 * means the accent cannot leak onto a non-docs page.
 *
 * The pathname it takes is the *internal* one, which is what the router exposes:
 * `/pl/docs/dev` has already had its prefix stripped by the rewrite, so this
 * never has to know about languages.
 */
export const docsSectionOf = (pathname: string): string | undefined => {
  const [, docs, section] = pathname.split('/')

  return docs === 'docs' && section ? section : undefined
}
