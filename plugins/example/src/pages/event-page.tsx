import { EditorContent } from "@vitnode/core/components/ui/editor-content";
import {
  definePluginRoute,
  type PluginRoutePageProps,
} from "@vitnode/core/routing";
import { contentPageItem } from "@vitnode/core/tanstack/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { useTranslations } from "use-intl";
import { z } from "zod";

import { CONFIG_PLUGIN } from "@/const";

import { ContentArticle } from "./content-article";

// `id` is a decimal string: `example.event` uses the `bigint` id strategy, and
// an identifier above 2^53 would not survive a round trip through a number.
const zodEvent = z.object({
  body: z.string(),
  id: z.string(),
  publishedAt: z.string().nullable(),
  sessions: z.array(
    z.object({ startsAt: z.string().nullable(), title: z.string() }),
  ),
  title: z.string(),
});

const loadEvent = async ({
  locale,
  slug,
}: {
  locale: string;
  slug: string;
}) => {
  const detail = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    method: "get",
    module: "content/events",
    path: "/{slug}",
    args: {
      params: { slug: encodeURIComponent(slug) },
      query: { locale },
    },
  });

  return {
    item: contentPageItem(
      detail.status === 200 ? zodEvent.parse(await detail.json()) : null,
    ),
    locale,
  };
};

type EventPageData = Awaited<ReturnType<typeof loadEvent>>;

export const route = definePluginRoute({
  load: async ({ context, params }) =>
    await loadEvent({ locale: context.locale, slug: params.slug }),

  head: ({ loaderData }) => ({ title: loaderData?.item.title }),
});

const EventPage = ({
  loaderData: { item, locale },
}: PluginRoutePageProps<EventPageData>) => {
  const t = useTranslations("@vitnode/example.events");

  return (
    <ContentArticle
      lang={locale}
      publishedAt={item.publishedAt}
      title={item.title}
    >
      <div className="leading-relaxed">
        <EditorContent content={item.body} />
      </div>

      {item.sessions.length > 0 ? (
        <section
          aria-labelledby="event-sessions"
          className="flex flex-col gap-3"
        >
          <h2
            className="text-foreground text-xl font-semibold text-balance"
            id="event-sessions"
          >
            {t("sessions")}
          </h2>
          <ul className="flex flex-col gap-2">
            {item.sessions.map(session => (
              <li
                className="text-foreground leading-relaxed text-pretty"
                key={`${session.title}-${session.startsAt ?? ""}`}
              >
                {session.title}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </ContentArticle>
  );
};

export default EventPage;
