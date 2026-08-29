import type { PluginRoutePageProps } from "@vitnode/core/routing";

import { definePluginRoute } from "@vitnode/core/routing";
import { useTranslations } from "use-intl";

/**
 * The three seams of a route, in one file: what it accepts, what it resolves,
 * and what it renders.
 *
 * This is the page `routes/manifest.ts` declares at `/example/guide/:topic`, and
 * it is here to be the smallest honest example of a route that is *about*
 * something. Everything it needs arrives through the contract rather than
 * through a router: `load` is handed the parsed `params`, the component is
 * handed what `load` returned, and neither imports anything that knows what a
 * router is.
 */

/**
 * Stand-in for whatever a real plugin reads.
 *
 * A record here rather than a fetch, because what this example is demonstrating
 * is the shape of the seams, and a database would only make that harder to see.
 * A real plugin's `load` awaits its own Hono route through the host's
 * `QueryClient` - the API boundary is unchanged, and this is where the read is
 * *awaited*, not a second transport.
 */
const TOPICS: Record<string, { body: string; title: string }> = {
  entries: {
    body: "An entry is a package export subpath, so a plugin can move a page inside its own dist without breaking any app that installed it.",
    title: "Entries",
  },
  manifest: {
    body: "A manifest is plain data, read in Node with no framework loaded, which is why one plugin can serve a Next.js app and a TanStack Start app at once.",
    title: "The manifest",
  },
  namespaces: {
    body: "Namespaces are declared on the route rather than inside the module, so a page's strings and a page's code are fetched at the same time instead of one after the other.",
    title: "Namespaces",
  },
};

/**
 * What the loader resolved, rendered.
 *
 * `loaderData` is not optional here, and the asymmetry with `head` below is
 * worth knowing rather than working around: a match does not render until its
 * loader has resolved, so by the time this component exists the data is in hand.
 * `head` runs on passes where it has not, which is why its `loaderData` is
 * optional and this one is not.
 *
 * `params` and `search` arrive the same way and under the same names they have
 * in `load` and `head`, so there is one vocabulary for a route rather than three.
 */
const GuideTopicPage = ({
  loaderData,
  search,
}: PluginRoutePageProps<Topic, TopicSearch>) => {
  const t = useTranslations("@vitnode/example.guide");

  return (
    <article className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold tracking-tight text-balance">
        {loaderData.title}
      </h2>

      <p className="leading-relaxed text-pretty">{loaderData.body}</p>

      {search.from === "index" ? (
        <p className="text-muted-foreground text-sm leading-relaxed">
          {t("topic.from_index")}
        </p>
      ) : null}
    </article>
  );
};

interface Topic {
  body: string;
  title: string;
}

interface TopicSearch {
  /** Empty rather than absent, so the component never branches on `undefined`. */
  from: string;
}

/**
 * `load` above `head`, and that order is load-bearing.
 *
 * TypeScript resolves an object literal's context-sensitive members in the order
 * they are written, so `head`'s `loaderData` is only typed once `load` has been
 * read. Written the other way round, `definePluginRoute` reports it in those
 * words rather than as `Property 'title' does not exist on type '{}'`.
 */
export const route = definePluginRoute({
  /**
   * Total, never throwing.
   *
   * A pasted or hand-edited query string has to render the page it would have
   * rendered anyway - throwing here turns `?from=whatever` into a router error
   * screen. It returns only what this route recognises, so nothing else is
   * carried forward.
   */
  validateSearch: (input: unknown): TopicSearch => {
    const from = (input as null | Partial<TopicSearch>)?.from;

    return { from: from === "index" ? "index" : "" };
  },
  load: ({ params }): Topic =>
    TOPICS[params.topic] ?? {
      body: "",
      title: params.topic,
    },
  /**
   * The `<title>` and the `<h1>` are the same string by construction, because
   * both read the one object the loader returned.
   *
   * No `robots`: the layout above declares it, the router merges `head` down the
   * matched routes, and a child inherits by saying nothing.
   */
  head: ({ loaderData }) => ({ title: loaderData?.title }),
});

export default GuideTopicPage;
