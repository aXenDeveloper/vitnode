/**
 * The page `routes/manifest.ts` declares, and the first plugin route module a
 * VitNode app bundles rather than copies.
 *
 * Zero imports, which is the point rather than an accident. It is compiled into
 * this package's `dist` and imported by the app as
 * `@vitnode/example/routes/example-page`, so it has to be renderable by whatever
 * framework the app happens to use. Anything from a router, a framework's data
 * APIs or a host-bound i18n package would pin it to one of them; a component that
 * only needs JSX is pinned to none.
 *
 * It exports a default component because that is how every VitNode plugin page
 * already exports itself, and because a default export is the one name a
 * generated registry can rely on without being told.
 *
 * No `<main>`, and that is part of the contract rather than a style choice. A
 * plugin route declares `area: "main"`, which puts it inside the application
 * shell - and the shell renders the document's one `<main>` landmark. A page
 * that renders its own produces `<main><main>`: invalid HTML, and two "main"
 * landmarks for a screen reader to choose between. A plugin page owns its
 * container - its width, its padding, its vertical rhythm - and nothing above
 * it.
 */
const ExamplePage = () => (
  <div className="container mx-auto flex max-w-2xl flex-col gap-4 p-4">
    <h1 className="text-2xl font-semibold tracking-tight text-balance">
      Example plugin route
    </h1>

    <p className="text-muted-foreground leading-relaxed text-pretty">
      This page lives in <code>@vitnode/example</code> and is served by the app
      that installed it. It was never copied into the app&apos;s source: the app
      generated a literal import for it from the plugin&apos;s route manifest,
      and the bundler put it in its own chunk.
    </p>
  </div>
);

export default ExamplePage;
