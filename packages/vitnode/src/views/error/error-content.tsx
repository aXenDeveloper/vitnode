/**
 * An error screen: a status code, what it means, and what to do about it.
 *
 * Presentation and nothing else - no translations and no navigation, which is
 * what makes it renderable by both frameworks and, just as importantly, by a
 * React Server Component. `ErrorView` (this file's Next.js wrapper) is rendered
 * by `not-found.tsx` on the server *and* by the SSO callback in the browser, so
 * the strings have to be looked up by whoever knows which of the two it is:
 * `next-intl` reads Next's request scope in one and its client context in the
 * other, while a TanStack Start route reads `use-intl`. Both then hand the
 * finished text here.
 *
 * `actions` is a slot for the same reason: "go back" and "go home" are
 * navigation, and navigation is the framework's business.
 */
export const ErrorContent = ({
  actions,
  code,
  description,
  title,
}: {
  actions?: React.ReactNode;
  code: 400 | 403 | 404 | 409 | 429 | 500;
  description?: React.ReactNode;
  title?: React.ReactNode;
}) => (
  <div className="flex flex-col items-center justify-center px-4 py-10 sm:py-20">
    <div className="max-w-md space-y-6 text-center">
      <div className="space-y-2">
        <h1 className="text-primary text-8xl font-bold">{code}</h1>
        <h2 className="text-2xl font-medium">{title}</h2>
        <p className="text-muted-foreground">{description}</p>
      </div>

      <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
        {actions}
      </div>
    </div>
  </div>
);
