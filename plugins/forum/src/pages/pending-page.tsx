import type { PluginRoutePageProps } from "@vitnode/core/routing";

import { queryOptions } from "@tanstack/react-query";
import { Badge } from "@vitnode/core/components/ui/badge";
import { buttonVariants } from "@vitnode/core/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@vitnode/core/components/ui/empty";
import { LOADER_DATA_QUERY_META } from "@vitnode/core/lib/query-client";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { HrefLink } from "@vitnode/core/tanstack/link";
import {
  type AuthenticatedRouteLoadContext,
  defineAuthenticatedRoute,
} from "@vitnode/core/tanstack/plugin-routes";
import { InboxIcon } from "lucide-react";
import { useTranslations } from "use-intl";
import { z } from "zod";

import { CONFIG_PLUGIN } from "@/const";
import { commentContentType } from "@/content/comment";
import { topicContentType } from "@/content/topic";

import type { PendingSearch } from "./forum-links";

import {
  FORUM_HREF,
  forumHref,
  pendingHref,
  topicEditHref,
} from "./forum-links";
import { forumQueryKeys, PENDING_STALE_TIME } from "./forum-queries";
import { ForumShell, TimeAgo } from "./forum-ui";

const PAGE_SIZE = 25;

const zodSubmission = z.object({
  container: z.object({ name: z.string(), slug: z.string() }).nullable(),
  contentTypeId: z.string(),
  createdAt: z.string(),
  decidedAt: z.string().nullable(),
  id: z.number(),
  itemId: z.string(),
  kind: z.enum(["create", "edit"]),
  pluginId: z.string(),
  reason: z.string().nullable(),
  status: z.string(),
  title: z.string().nullable(),
});

type Submission = z.infer<typeof zodSubmission>;

/** The viewer's own submissions, keyed by who they are so another account in this tab never reads them. */
const pendingQueryOptions = ({
  page,
  userId,
}: {
  page: number;
  userId: number;
}) =>
  queryOptions({
    meta: LOADER_DATA_QUERY_META,
    queryFn: async () => {
      const res = await fetcher({
        plugin: "@vitnode/core",
        method: "get",
        module: "moderation",
        path: "/approvals/mine",
        args: { query: { page, pageSize: PAGE_SIZE } },
      });

      if (res.status !== 200) {
        throw new Error("Loading your submissions failed.");
      }

      const data = await res.json();

      return {
        // The queue is every plugin's; this page is the forum's corner of it.
        items: z
          .array(zodSubmission)
          .parse(data.items)
          .filter(item => item.pluginId === CONFIG_PLUGIN.pluginId),
        page: data.page,
        pageCount: Math.max(1, Math.ceil(data.total / data.pageSize)),
      };
    },
    queryKey: forumQueryKeys.pending(userId, page),
    staleTime: PENDING_STALE_TIME,
  });

const loadPending = async (
  { auth, queryClient }: AuthenticatedRouteLoadContext,
  { page = 1 }: PendingSearch,
) =>
  await queryClient.query(pendingQueryOptions({ page, userId: auth.user.id }));

type PendingPageData = Awaited<ReturnType<typeof loadPending>>;

const PendingBreadcrumb = () => {
  const t = useTranslations("@vitnode/forum.pending");

  return <span>{t("title")}</span>;
};

export const route = defineAuthenticatedRoute<PendingPageData, PendingSearch>({
  load: async ({ context, search }) => await loadPending(context, search),

  head: ({ t }) => ({
    description: t("@vitnode/forum.pending.desc"),
    robots: "noindex, nofollow",
    title: t("@vitnode/forum.pending.title"),
  }),

  breadcrumb: PendingBreadcrumb,
});

const STATUS_VARIANT = {
  approved: "success",
  pending: "warning",
  rejected: "destructive",
} as const;

const isKnownStatus = (status: string): status is keyof typeof STATUS_VARIANT =>
  status in STATUS_VARIANT;

const SubmissionRow = ({ item }: { item: Submission }) => {
  const t = useTranslations("@vitnode/forum.pending");
  const isTopic = item.contentTypeId === topicContentType.id;
  const isComment = item.contentTypeId === commentContentType.id;
  const status = isKnownStatus(item.status) ? item.status : "pending";
  const title =
    item.title ?? (isComment ? t("untitled_comment") : t("untitled_topic"));

  return (
    <li className="flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={STATUS_VARIANT[status]}>{t(`status.${status}`)}</Badge>
        <Badge variant="outline">
          {t(isComment ? "type.comment" : "type.topic")} ·{" "}
          {t(`kind.${item.kind}`)}
        </Badge>
      </div>

      {isTopic ? (
        <HrefLink
          className="text-foreground font-medium text-balance hover:underline"
          href={topicEditHref(item.itemId)}
        >
          {title}
        </HrefLink>
      ) : (
        <span className="text-foreground font-medium text-balance">
          {title}
        </span>
      )}

      <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-relaxed">
        <span>
          {t("submitted")} <TimeAgo date={item.createdAt} />
        </span>
        {item.container ? (
          <>
            <span aria-hidden="true">·</span>
            <HrefLink
              className="hover:underline"
              href={forumHref(item.container.slug)}
            >
              {item.container.name}
            </HrefLink>
          </>
        ) : null}
      </p>

      {status === "rejected" ? (
        <p className="text-destructive text-sm leading-relaxed text-pretty">
          {item.reason ? t("reason", { reason: item.reason }) : t("no_reason")}
        </p>
      ) : null}
    </li>
  );
};

const PendingPage = ({
  loaderData: { items, page, pageCount },
}: PluginRoutePageProps<PendingPageData, PendingSearch>) => {
  const t = useTranslations("@vitnode/forum.pending");

  return (
    <ForumShell description={t("desc")} title={t("title")}>
      {items.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <InboxIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle render={<h2 />}>{t("empty.title")}</EmptyTitle>
            <EmptyDescription>{t("empty.desc")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <HrefLink
              className={buttonVariants({ variant: "outline" })}
              href={FORUM_HREF}
            >
              {t("empty.action")}
            </HrefLink>
          </EmptyContent>
        </Empty>
      ) : (
        <ul className="bg-card flex flex-col divide-y rounded-xl border">
          {items.map(item => (
            <SubmissionRow item={item} key={item.id} />
          ))}
        </ul>
      )}

      {pageCount > 1 ? (
        <nav
          aria-label={t("pagination")}
          className="flex flex-wrap items-center gap-2"
        >
          {page > 1 ? (
            <HrefLink
              className={buttonVariants({ variant: "outline" })}
              href={pendingHref(page - 1)}
            >
              {t("newer")}
            </HrefLink>
          ) : null}
          {page < pageCount ? (
            <HrefLink
              className={buttonVariants({ variant: "outline" })}
              href={pendingHref(page + 1)}
            >
              {t("older")}
            </HrefLink>
          ) : null}
        </nav>
      ) : null}
    </ForumShell>
  );
};

export default PendingPage;
