import type {
  PluginRouteBreadcrumbProps,
  PluginRoutePageProps,
} from "@vitnode/core/routing";

import { definePluginRoute } from "@vitnode/core/routing";
import { useTranslations } from "use-intl";

/**
 * The three seams of a route, in one file: what it accepts, what it resolves,
 * and what it renders.
 *
 * This is the page `routes.ts` declares at `:topic` inside the guide layout, and
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
  layouts: {
    body: "A layout claims no URL of its own: it frames its children, and the index() route inside it renders at the layout's own path.",
    title: "Layouts",
  },
  lazy: {
    body: 'lazy(() => import("./pages/...")) names the module a route renders. The import is a literal the bundler follows, so the page gets a chunk of its own and nothing runs until the route is matched.',
    title: "Lazy pages",
  },
  messages: {
    body: "Messages are declared on the route rather than inside the module, so a page's strings and a page's code are fetched at the same time instead of one after the other.",
    title: "Messages",
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
 * The crumb this page contributes, read from what its loader resolved.
 *
 * One item of the trail, not the trail: the layout above contributes "Plugin
 * routing guide" and this adds the topic's own title after it, so the shell
 * renders `Plugin routing guide / Layouts` without either route knowing about
 * the other. The props are the ones `load` and the component get - this route's
 * own, and typed by the same loader.
 */
const GuideTopicBreadcrumb = ({
  loaderData,
}: PluginRouteBreadcrumbProps<Topic>) => loaderData.title;

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
   *
   * It normalises the query string for `load`, `head` and the component, and it
   * is not the router's `validateSearch`: this module is lazy, so by the time it
   * exists the URL has long since been matched. No link is checked against this
   * and no URL is rejected by it.
   */
  parseSearch: (input: unknown): TopicSearch => {
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
  breadcrumb: GuideTopicBreadcrumb,
});

export default GuideTopicPage;
