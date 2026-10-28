import type { ContentContainerTreeNode } from "@vitnode/core/content";

import { HrefLink } from "@vitnode/core/tanstack/link";
import { LockIcon } from "lucide-react";
import { useFormatter, useTranslations } from "use-intl";

import type { Forum, ForumStats } from "./forum-data";

import { forumHref, topicHref } from "./forum-links";
import { ForumIcon, TimeAgo } from "./forum-ui";

const ForumRow = ({
  forum,
  stats,
}: {
  forum: Forum;
  stats: ForumStats | undefined;
}) => {
  const t = useTranslations("@vitnode/forum.forums");
  const format = useFormatter();
  const latest = stats?.latestTopic ?? null;
  const locked = !forum.access.canRead;

  return (
    <article className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:gap-6">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <ForumIcon icon={forum.metadata.icon} />
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-foreground font-semibold text-balance">
            <HrefLink
              className="focus-visible:ring-ring rounded-sm hover:underline focus-visible:ring-2 focus-visible:outline-none"
              href={forumHref(forum.slug)}
            >
              {forum.name}
            </HrefLink>
            {locked ? (
              <span className="text-muted-foreground ms-2 inline-flex items-center gap-1 align-middle text-xs font-normal">
                <LockIcon aria-hidden="true" className="size-3.5" />
                {t("members_only")}
              </span>
            ) : null}
          </h3>
          {forum.metadata.description ? (
            <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
              {forum.metadata.description}
            </p>
          ) : null}
        </div>
      </div>

      {locked ? null : (
      <dl className="text-muted-foreground flex items-center gap-6 text-sm md:w-40 md:justify-end">
        <div className="flex flex-col md:items-end">
          <dt>{t("stats.topics")}</dt>
          <dd className="text-foreground font-medium tabular-nums">
            {format.number(stats?.topicCount ?? 0)}
          </dd>
        </div>
        <div className="flex flex-col md:items-end">
          <dt>{t("stats.comments")}</dt>
          <dd className="text-foreground font-medium tabular-nums">
            {format.number(stats?.commentCount ?? 0)}
          </dd>
        </div>
      </dl>
      )}

      {locked ? null : (
      <div className="flex min-w-0 flex-col gap-1 text-sm leading-relaxed md:w-56">
        {latest ? (
          <>
            <span className="text-muted-foreground">{t("latest")}</span>
            <HrefLink
              className="text-foreground truncate font-medium hover:underline"
              href={topicHref(latest.slug)}
            >
              {latest.title}
            </HrefLink>
            {latest.publishedAt ? (
              <span className="text-muted-foreground">
                <TimeAgo date={latest.publishedAt} />
              </span>
            ) : null}
          </>
        ) : (
          <span className="text-muted-foreground">{t("no_topics_yet")}</span>
        )}
      </div>
      )}
    </article>
  );
};

const ForumListItems = ({
  nodes,
  stats,
}: {
  nodes: ContentContainerTreeNode<Forum>[];
  stats: ReadonlyMap<number, ForumStats>;
}) => (
  <ul className="flex flex-col divide-y">
    {nodes.map(node => (
      <li className="flex flex-col" key={node.id}>
        <ForumRow forum={node} stats={stats.get(node.id)} />
        {node.children.length > 0 ? (
          <div className="bg-muted/40 border-t pl-4 md:pl-8">
            <ForumListItems nodes={node.children} stats={stats} />
          </div>
        ) : null}
      </li>
    ))}
  </ul>
);

export const ForumList = ({
  label,
  nodes,
  stats,
}: {
  label: string;
  nodes: ContentContainerTreeNode<Forum>[];
  stats: ReadonlyMap<number, ForumStats>;
}) => (
  <nav aria-label={label} className="bg-card overflow-hidden rounded-xl border">
    <ForumListItems nodes={nodes} stats={stats} />
  </nav>
);
