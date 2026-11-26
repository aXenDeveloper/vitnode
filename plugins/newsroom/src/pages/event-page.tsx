import { RichTextContent } from "@vitnode/core/components/rich-text";
import { zodRichTextDocument } from "@vitnode/core/content";
import { type PluginRoutePageProps } from "@vitnode/core/routing";
import {
  autoTranslateItem,
  AutoTranslateNote,
  AutoTranslateScope,
  loadAutoTranslateSnapshot,
  useAutoTranslation,
} from "@vitnode/core/tanstack/auto-translate";
import { contentPageItem } from "@vitnode/core/tanstack/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import {
  defineRoute,
  type RouteLoadContext,
} from "@vitnode/core/tanstack/plugin-routes";
import { useTranslations } from "use-intl";
import { z } from "zod";

import { eventContentType } from "@/content/event";
import { manifest } from "@/manifest.gen";

import { ContentStory } from "./content-story";

const zodEvent = z.object({
  body: zodRichTextDocument.nullable(),
  id: z.string(),
  locale: z.string(),
  publishedAt: z.string().nullable(),
  sessions: z.array(
    z.object({ startsAt: z.string().nullable(), title: z.string() }),
  ),
  title: z.string(),
});

const loadEvent = async (
  { locale, queryClient }: RouteLoadContext,
  slug: string,
) => {
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

  const item = contentPageItem(
    detail.status === 200 ? zodEvent.parse(await detail.json()) : null,
  );
  const translations = await loadAutoTranslateSnapshot(queryClient, {
    items: [
      autoTranslateItem(
        eventContentType.id,
        item.id,
        { body: item.body },
        { recordLocale: item.locale },
      ),
    ],
    locale,
  });

  return { item, locale, translations };
};

type EventPageData = Awaited<ReturnType<typeof loadEvent>>;

export const route = defineRoute<EventPageData>({
  load: async ({ context, params }) => await loadEvent(context, params.slug),

  head: ({ loaderData }) => ({ title: loaderData?.item.title }),
});

const EventPage = (props: PluginRoutePageProps<EventPageData>) => (
  <AutoTranslateScope
    initial={props.loaderData.translations}
    // A new store per record: moving to another one starts from its snapshot.
    key={props.loaderData.item.id}
  >
    <EventView {...props} />
  </AutoTranslateScope>
);

const EventView = ({
  loaderData: { item, locale },
}: PluginRoutePageProps<EventPageData>) => {
  const t = useTranslations("newsroom.events");
  const { elementRef, ...translation } = useAutoTranslation({
    contentTypeId: eventContentType.id,
    fields: { body: item.body },
    id: item.id,
    recordLocale: item.locale,
  });

  return (
    <ContentStory
      elementRef={elementRef}
      lang={item.locale}
      publishedAt={item.publishedAt}
      title={item.title}
    >
      {translation.values.body ? (
        <div lang={translation.isTranslated ? locale : undefined}>
          <RichTextContent
            className="text-foreground leading-relaxed text-pretty"
            content={translation.values.body}
          />
        </div>
      ) : null}
      <AutoTranslateNote translation={translation} />

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
    </ContentStory>
  );
};

export default EventPage;
