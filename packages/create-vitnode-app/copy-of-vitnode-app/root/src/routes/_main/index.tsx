import { createFileRoute } from "@tanstack/react-router";

import { pageHead } from "#/lib/page-head";

export const Route = createFileRoute("/_main/")({
  head: () =>
    pageHead({
      description: "A VitNode application.",
      robots: "index, follow",
      title: "Home",
    }),
  component: HomeRoute,
});

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
