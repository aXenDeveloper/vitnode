import { RichTextContent } from "@vitnode/core/components/rich-text";
import { zodRichTextDocument } from "@vitnode/core/content";
import {
  definePluginRoute,
  type PluginRoutePageProps,
} from "@vitnode/core/routing";
import { contentPageItem } from "@vitnode/core/tanstack/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { useTranslations } from "use-intl";
import { z } from "zod";

import { manifest } from "@/manifest.gen";

import { ContentArticle } from "./content-article";

const zodEvent = z.object({
  body: zodRichTextDocument.nullable(),
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
    plugin: manifest.id,
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
      {item.body ? (
        <RichTextContent
          className="text-foreground leading-relaxed text-pretty"
          content={item.body}
        />
      ) : null}

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
