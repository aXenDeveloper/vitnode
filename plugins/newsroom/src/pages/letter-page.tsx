import type { PluginRoutePageProps } from "@vitnode/core/routing";

import { RichTextContent } from "@vitnode/core/components/rich-text";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@vitnode/core/components/ui/alert";
import { buttonVariants } from "@vitnode/core/components/ui/button";
import { UserFormat } from "@vitnode/core/components/user-format";
import {
  CONTENT_HIDDEN_HEADER,
  zodContentPublicPerson,
  zodRichTextDocument,
} from "@vitnode/core/content";
import { contentPageItem } from "@vitnode/core/tanstack/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { HrefLink } from "@vitnode/core/tanstack/link";
import {
  defineRoute,
  type RouteLoadContext,
} from "@vitnode/core/tanstack/plugin-routes";
import { EyeOffIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import { manifest } from "@/manifest.gen";

import type { LetterSearch } from "./letter-search";

import { ContentStory } from "./content-story";
import { queryDesk } from "./desk-queries";
import { deskHref, DESKS_HREF } from "./desk-search";
import { LetterActions } from "./letter-actions";
import { useLetterPermissions } from "./letter-list";
import { letterNewHref } from "./letter-search";

const zodLetter = z.object({
  author: zodContentPublicPerson.nullable(),
  desk: z.number(),
  body: zodRichTextDocument,
  id: z.number(),
  publishedAt: z.string().nullable(),
  title: z.string(),
});

const loadLetter = async (
  queryClient: RouteLoadContext["queryClient"],
  slug: string,
) => {
  const detail = await fetcher({
    plugin: manifest.id,
    method: "get",
    module: "content/letters",
    path: "/{slug}",
    args: { params: { slug: encodeURIComponent(slug) } },
  });

  const item = contentPageItem(
    detail.status === 200 ? zodLetter.parse(await detail.json()) : null,
  );
  // Only the author and moderators get a hidden letter; readers get 404.
  const hidden = detail.headers.get(CONTENT_HIDDEN_HEADER) === "true";

  // Needs `item.desk`, so it cannot start any sooner - but it is the same
  // cached entry the desk page reads, so moving between the two is free.
  const desk = await queryDesk(queryClient, String(item.desk)).catch(
    () => null,
  );

  if (!desk) return { ...item, deskTrail: [], hidden };

  return {
    ...item,
    deskTrail: [...desk.ancestors, desk.container],
    hidden,
  };
};

type LetterPageData = Awaited<ReturnType<typeof loadLetter>>;

export const route = defineRoute<LetterPageData, LetterSearch>({
  load: async ({ context, params }) =>
    await loadLetter(context.queryClient, params.slug),

  head: ({ loaderData }) => ({ title: loaderData?.title }),

  breadcrumb: ({ loaderData }) => <span>{loaderData.title}</span>,
});

const LetterPage = ({
  loaderData: item,
  navigate,
  search,
}: PluginRoutePageProps<LetterPageData, LetterSearch>) => {
  const t = useTranslations("newsroom.letters.detail");
  const permissions = useLetterPermissions([item.id]);
  const created = search.created === true;
  const announcedRef = useRef(false);

  useEffect(() => {
    // oxlint-disable-next-line react-you-might-not-need-an-effect/no-event-handler -- the event happened on the previous page; landing here is all that is left of it
    if (!created || announcedRef.current) return;
    announcedRef.current = true;

    toast.success(t("created.title"), { description: t("created.desc") });
    void navigate({ resetScroll: false, search: {} });
  }, [created, navigate, t]);

  return (
    <ContentStory publishedAt={item.publishedAt} title={item.title}>
      {item.deskTrail.length > 0 ? (
        <nav aria-label={t("desk")}>
          <ol className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm leading-relaxed">
            <li>
              <HrefLink className="hover:text-foreground" href={DESKS_HREF}>
                {t("desks")}
              </HrefLink>
            </li>
            {item.deskTrail.map(desk => (
              <li className="flex items-center gap-2" key={desk.id}>
                <span aria-hidden="true">/</span>
                <HrefLink
                  className="hover:text-foreground"
                  href={deskHref(desk.slug)}
                >
                  {desk.name}
                </HrefLink>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm leading-relaxed">
        {t("posted_by")}
        {item.author ? (
          <UserFormat format link user={item.author} />
        ) : (
          <span>{t("deleted_user")}</span>
        )}
      </p>

      {item.hidden ? (
        <Alert icon={<EyeOffIcon />} variant="warning">
          <AlertTitle>{t("hidden.title")}</AlertTitle>
          <AlertDescription>{t("hidden.desc")}</AlertDescription>
        </Alert>
      ) : null}

      <nav aria-label={t("actions")} className="flex flex-wrap gap-2">
        <LetterActions
          can={permissions.of(item.id)}
          id={item.id}
          title={item.title}
        />
        <HrefLink
          className={buttonVariants({ variant: "ghost" })}
          href={letterNewHref(item.desk)}
        >
          {t("new")}
        </HrefLink>
      </nav>

      <RichTextContent
        className="text-foreground leading-relaxed text-pretty"
        content={item.body}
      />
    </ContentStory>
  );
};

export default LetterPage;
