import { RichTextContent } from "@vitnode/core/components/rich-text";
import { buttonVariants } from "@vitnode/core/components/ui/button";
import { zodRichTextDocument } from "@vitnode/core/content";
import {
  definePluginRoute,
  type PluginRoutePageProps,
} from "@vitnode/core/routing";
import { contentPageItem } from "@vitnode/core/tanstack/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { HrefLink } from "@vitnode/core/tanstack/link";
import { PencilIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import { CONFIG_PLUGIN } from "@/const";

import type { DiscussionSearch } from "./discussion-search";

import { boardHref, BOARDS_HREF } from "./board-search";
import { ContentArticle } from "./content-article";
import { discussionEditHref, discussionNewHref } from "./discussion-search";

const zodDiscussion = z.object({
  board: z.number(),
  body: zodRichTextDocument,
  id: z.number(),
  publishedAt: z.string().nullable(),
  title: z.string(),
});

const loadDiscussion = async (slug: string) => {
  const detail = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    method: "get",
    module: "content/discussions",
    path: "/{slug}",
    args: { params: { slug: encodeURIComponent(slug) } },
  });

  const item = contentPageItem(
    detail.status === 200 ? zodDiscussion.parse(await detail.json()) : null,
  );

  const board = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    method: "get",
    module: "content/boards",
    path: "/{idOrSlug}",
    args: { params: { idOrSlug: String(item.board) } },
  });

  if (board.status !== 200) return { ...item, boardTrail: [] };

  const { ancestors, container } = await board.json();

  return { ...item, boardTrail: [...ancestors, container] };
};

type DiscussionPageData = Awaited<ReturnType<typeof loadDiscussion>>;

export const route = definePluginRoute<DiscussionPageData, DiscussionSearch>({
  load: async ({ params }) => await loadDiscussion(params.slug),

  head: ({ loaderData }) => ({ title: loaderData?.title }),

  breadcrumb: ({ loaderData }) => <span>{loaderData.title}</span>,
});

const DiscussionPage = ({
  loaderData: item,
  navigate,
  search,
}: PluginRoutePageProps<DiscussionPageData, DiscussionSearch>) => {
  const t = useTranslations("@vitnode/example.discussions.detail");
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
    <ContentArticle publishedAt={item.publishedAt} title={item.title}>
      {item.boardTrail.length > 0 ? (
        <nav aria-label={t("board")}>
          <ol className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm leading-relaxed">
            <li>
              <HrefLink className="hover:text-foreground" href={BOARDS_HREF}>
                {t("boards")}
              </HrefLink>
            </li>
            {item.boardTrail.map(board => (
              <li className="flex items-center gap-2" key={board.id}>
                <span aria-hidden="true">/</span>
                <HrefLink
                  className="hover:text-foreground"
                  href={boardHref(board.slug)}
                >
                  {board.name}
                </HrefLink>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      <nav aria-label={t("actions")} className="flex flex-wrap gap-2">
        <HrefLink
          className={buttonVariants({ variant: "outline" })}
          href={discussionEditHref(item.id)}
        >
          <PencilIcon aria-hidden="true" />
          {t("edit")}
        </HrefLink>
        <HrefLink
          className={buttonVariants({ variant: "ghost" })}
          href={discussionNewHref(item.board)}
        >
          {t("new")}
        </HrefLink>
      </nav>

      <RichTextContent
        className="text-foreground leading-relaxed text-pretty"
        content={item.body}
      />
    </ContentArticle>
  );
};

export default DiscussionPage;
