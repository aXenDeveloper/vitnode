import { createFileRoute } from "@tanstack/react-router";

import { pageHead } from "#/lib/page-head";

/**
 * The front page.
 *
 * One route file serving every public URL of the home page: `/` and `/pl` both
 * match here, because the locale is stripped before matching and written back
 * into every link the router builds. There is no `routes/pl/index.tsx` and there
 * does not need to be one.
 *
 * **`head` must be written after `loader`** on routes that have one -
 * `loaderData` is inferred from `loader` in the same object literal, and
 * TypeScript reads a literal's members in order. This route has no loader: it
 * fetches nothing, and the shell above it already warmed everything the header
 * reads.
 *
 * `robots: 'index, follow'` is stated rather than assumed. `_main` says nothing
 * about indexing, and a page that wants to be found should say so where somebody
 * editing it will see it.
 */
export const Route = createFileRoute("/_main/")({
  head: () =>
    pageHead({
      description: "A VitNode application.",
      robots: "index, follow",
      title: "Home",
    }),
  component: HomeRoute,
});

/**
 * Replace this with your own home page.
 *
 * No `<main>`: the shell owns the document's one `main` landmark, and a page
 * that renders a second gives a screen reader two to choose between. A page owns
 * its container - width, padding, vertical rhythm - and nothing above it.
 *
 * The copy is hard-coded because a new app has no strings of its own yet. To
 * translate it, add the keys to `src/locales/` and read them with
 * `useTranslations` from `use-intl` - the same hook every VitNode component
 * uses, on every host.
 */
function HomeRoute() {
  return (
    <div className="container mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <h1 className="text-3xl font-semibold tracking-tight text-balance">
        Welcome to VitNode
      </h1>

      <p className="text-muted-foreground leading-relaxed text-pretty">
        Edit <code>src/routes/_main/index.tsx</code> to change this page. The
        header, the footer and the shell around it are{" "}
        <code>@vitnode/core</code>&rsquo;s; everything under{" "}
        <code>src/routes</code> is yours.
      </p>
    </div>
  );
}
