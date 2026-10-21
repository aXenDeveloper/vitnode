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

import type { DiscussionSearch } from "./discussion-search";

import { boardHref, BOARDS_HREF } from "./board-search";
import { ContentArticle } from "./content-article";
import { DiscussionActions } from "./discussion-actions";
import { useDiscussionPermissions } from "./discussion-list";
import { discussionNewHref } from "./discussion-search";
import { queryBoard } from "./example-queries";

const zodDiscussion = z.object({
  author: zodContentPublicPerson.nullable(),
  board: z.number(),
  body: zodRichTextDocument,
  id: z.number(),
  publishedAt: z.string().nullable(),
  title: z.string(),
});

const loadDiscussion = async (
  queryClient: RouteLoadContext["queryClient"],
  slug: string,
) => {
  const detail = await fetcher({
    plugin: manifest.id,
    method: "get",
    module: "content/discussions",
    path: "/{slug}",
    args: { params: { slug: encodeURIComponent(slug) } },
  });

  const item = contentPageItem(
    detail.status === 200 ? zodDiscussion.parse(await detail.json()) : null,
  );
  // Only the author and moderators get a hidden discussion; readers get 404.
  const hidden = detail.headers.get(CONTENT_HIDDEN_HEADER) === "true";

  // Needs `item.board`, so it cannot start any sooner - but it is the same
  // cached entry the board page reads, so moving between the two is free.
  const board = await queryBoard(queryClient, String(item.board)).catch(
    () => null,
  );

  if (!board) return { ...item, boardTrail: [], hidden };

  return {
    ...item,
    boardTrail: [...board.ancestors, board.container],
    hidden,
  };
};

type DiscussionPageData = Awaited<ReturnType<typeof loadDiscussion>>;

export const route = defineRoute<DiscussionPageData, DiscussionSearch>({
  load: async ({ context, params }) =>
    await loadDiscussion(context.queryClient, params.slug),

  head: ({ loaderData }) => ({ title: loaderData?.title }),

  breadcrumb: ({ loaderData }) => <span>{loaderData.title}</span>,
});

const DiscussionPage = ({
  loaderData: item,
  navigate,
  search,
}: PluginRoutePageProps<DiscussionPageData, DiscussionSearch>) => {
  const t = useTranslations("@vitnode/example.discussions.detail");
  const permissions = useDiscussionPermissions([item.id]);
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
        <DiscussionActions
          can={permissions.of(item.id)}
          id={item.id}
          title={item.title}
        />
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
