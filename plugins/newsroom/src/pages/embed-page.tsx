import { definePluginRoute } from "@vitnode/core/routing";

export const route = definePluginRoute({
  head: () => ({
    robots: "noindex, nofollow",
    title: "Standalone",
  }),
});

const EmbedPage = () => (
  <main className="flex min-h-svh flex-col items-center justify-center gap-3 p-6 text-center">
    <h1 className="text-2xl font-semibold tracking-tight text-balance">
      A page with no shell
    </h1>

    <p className="text-muted-foreground max-w-2xl leading-relaxed text-pretty">
      This route declares <code>area: &quot;blank&quot;</code>, so the host
      mounts it at the root of its tree: theme, providers and translations, but
      no header, no footer and no AdminCP sidebar.
    </p>
  </main>
);

export default EmbedPage;
