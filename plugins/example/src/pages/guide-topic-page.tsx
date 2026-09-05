import type {
  PluginRouteBreadcrumbProps,
  PluginRoutePageProps,
} from "@vitnode/core/routing";

import { definePluginRoute } from "@vitnode/core/routing";
import { useTranslations } from "use-intl";

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

const GuideTopicBreadcrumb = ({
  loaderData,
}: PluginRouteBreadcrumbProps<Topic>) => loaderData.title;

export const route = definePluginRoute({
  parseSearch: (input: unknown): TopicSearch => {
    const from = (input as null | Partial<TopicSearch>)?.from;

    return { from: from === "index" ? "index" : "" };
  },
  load: ({ params }): Topic =>
    TOPICS[params.topic] ?? {
      body: "",
      title: params.topic,
    },

  head: ({ loaderData }) => ({ title: loaderData?.title }),
  breadcrumb: GuideTopicBreadcrumb,
});

export default GuideTopicPage;
