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
import {
  definePluginRoute,
  type PluginRoutePageProps,
} from "@vitnode/core/routing";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { InboxIcon } from "lucide-react";
import { useTranslations } from "use-intl";
import { z } from "zod";

import { CONFIG_PLUGIN } from "@/const";
import { replyContentType } from "@/content/reply";
import { topicContentType } from "@/content/topic";

import type { PendingSearch } from "./forum-links";

import {
  FORUM_HREF,
  forumHref,
  pendingHref,
  topicEditHref,
} from "./forum-links";
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

const loadPending = async ({ page = 1 }: PendingSearch) => {
  const res = await fetcher({
    plugin: "@vitnode/core",
    method: "get",
    module: "moderation",
    path: "/approvals/mine",
    args: { query: { page, pageSize: PAGE_SIZE } },
  });

  if (res.status !== 200) throw new Error("Loading your submissions failed.");

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
};

type PendingPageData = Awaited<ReturnType<typeof loadPending>>;

const PendingBreadcrumb = () => {
  const t = useTranslations("@vitnode/forum.pending");

  return <span>{t("title")}</span>;
};

export const route = definePluginRoute<PendingPageData, PendingSearch>({
  load: async ({ search }) => await loadPending(search),

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
  const isReply = item.contentTypeId === replyContentType.id;
  const status = isKnownStatus(item.status) ? item.status : "pending";
  const title =
    item.title ?? (isReply ? t("untitled_reply") : t("untitled_topic"));

  return (
    <li className="flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={STATUS_VARIANT[status]}>{t(`status.${status}`)}</Badge>
        <Badge variant="outline">
          {t(isReply ? "type.reply" : "type.topic")} · {t(`kind.${item.kind}`)}
        </Badge>
      </div>

      {isTopic ? (
        <a
          className="text-foreground font-medium text-balance hover:underline"
          href={topicEditHref(item.itemId)}
        >
          {title}
        </a>
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
            <a
              className="hover:underline"
              href={forumHref(item.container.slug)}
            >
              {item.container.name}
            </a>
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
            <a
              className={buttonVariants({ variant: "outline" })}
              href={FORUM_HREF}
            >
              {t("empty.action")}
            </a>
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
            <a
              className={buttonVariants({ variant: "outline" })}
              href={pendingHref(page - 1)}
            >
              {t("newer")}
            </a>
          ) : null}
          {page < pageCount ? (
            <a
              className={buttonVariants({ variant: "outline" })}
              href={pendingHref(page + 1)}
            >
              {t("older")}
            </a>
          ) : null}
        </nav>
      ) : null}
    </ForumShell>
  );
};

export default PendingPage;
