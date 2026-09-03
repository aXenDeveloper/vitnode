const ExamplePage = () => (
  <div className="container mx-auto flex max-w-2xl flex-col gap-4 p-4">
    <h1 className="text-2xl font-semibold tracking-tight text-balance">
      Example plugin route
    </h1>

    <p className="text-muted-foreground leading-relaxed text-pretty">
      This page lives in <code>@vitnode/example</code> and is served by the app
      that installed it. It was never copied into the app&apos;s source: the
      plugin&apos;s <code>routes.ts</code> names this module with{" "}
      <code>lazy(() =&gt; import(&quot;./pages/example-page&quot;))</code>, and
      the bundler put it in its own chunk.
    </p>
  </div>
);

export default ExamplePage;
