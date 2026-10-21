import type { PluginRoutePageProps } from "@vitnode/core/routing";

import { DateFormat } from "@vitnode/core/components/date-format";
import { buttonVariants } from "@vitnode/core/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@vitnode/core/components/ui/empty";
import { Input } from "@vitnode/core/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@vitnode/core/components/ui/native-select";
import { UserFormat } from "@vitnode/core/components/user-format";
import { LOADER_DATA_QUERY_META } from "@vitnode/core/lib/query-client";
import {
  contentListPageHead,
  ContentListPagination,
  ContentListResults,
  useContentListSearchInput,
} from "@vitnode/core/tanstack/content";
import { HrefLink } from "@vitnode/core/tanstack/link";
import {
  defineRoute,
  type RouteLoadContext,
} from "@vitnode/core/tanstack/plugin-routes";
import {
  MessagesSquareIcon,
  SearchXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import type { DiscussionListSearch } from "./discussion-list";

import { DiscussionActions } from "./discussion-actions";
import {
  discussionList,
  DISCUSSIONS_HREF,
  discussionsQueryOptions,
  useDiscussionPermissions,
} from "./discussion-list";
import { discussionHref, discussionNewHref } from "./discussion-search";
import { boardsQueryOptions } from "./example-queries";

const loadDiscussions = async (
  queryClient: RouteLoadContext["queryClient"],
  { locale, search }: { locale: string; search: DiscussionListSearch },
) => {
  // A failed list is an error state on the page, not an error page.
  const [discussions, boards] = await Promise.all([
    queryClient
      .query({
        ...discussionsQueryOptions({ locale, search }),
        meta: LOADER_DATA_QUERY_META,
      })
      .catch(() => null),
    queryClient.query(boardsQueryOptions()).catch(() => []),
  ]);

  return { boards, discussions };
};

type DiscussionsPageData = Awaited<ReturnType<typeof loadDiscussions>>;

export const route = defineRoute<DiscussionsPageData, DiscussionListSearch>({
  load: async ({ context, search }) =>
    await loadDiscussions(context.queryClient, {
      locale: context.locale,
      search,
    }),

  head: ({ search, t }) =>
    contentListPageHead({
      description: t("@vitnode/example.discussions.list.desc"),
      pathname: DISCUSSIONS_HREF,
      search,
      title: t("@vitnode/example.discussions.list.title"),
    }),
});

const ListState = ({
  action,
  description,
  icon,
  title,
}: {
  action?: React.ReactNode;
  description: string;
  icon: React.ReactNode;
  title: string;
}) => (
  <Empty className="border">
    <EmptyHeader>
      <EmptyMedia variant="icon">{icon}</EmptyMedia>
      <EmptyTitle render={<h2 />}>{title}</EmptyTitle>
      <EmptyDescription>{description}</EmptyDescription>
    </EmptyHeader>
    {action ? <EmptyContent>{action}</EmptyContent> : null}
  </Empty>
);

const DiscussionsPage = ({
  loaderData: { boards, discussions },
  navigate,
  search,
}: PluginRoutePageProps<DiscussionsPageData, DiscussionListSearch>) => {
  const t = useTranslations("@vitnode/example.discussions.list");
  const permissions = useDiscussionPermissions(
    discussions?.edges.map(discussion => discussion.id) ?? [],
  );
  const [isPending, startTransition] = React.useTransition();
  const update = (patch: Partial<DiscussionListSearch>) => {
    startTransition(async () => {
      await navigate({
        resetScroll: false,
        search: discussionList.withSearch(search, patch),
      });
    });
  };
  const input = useContentListSearchInput({
    onCommit: q => {
      update({ q });
    },
    value: search.q,
  });

  return (
    <div className="container mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 md:py-12">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-foreground text-3xl font-semibold tracking-tight text-balance">
            {t("title")}
          </h1>
          <p className="text-muted-foreground leading-relaxed text-pretty">
            {t("desc")}
          </p>
        </div>
        <HrefLink
          className={buttonVariants({ className: "self-start" })}
          href={discussionNewHref(search.board)}
        >
          {t("new")}
        </HrefLink>
      </header>

      <div
        className="flex flex-col gap-3 md:flex-row md:items-center"
        role="search"
      >
        <Input
          aria-label={t("search_label")}
          className="md:flex-1"
          onChange={event => {
            input.setValue(event.target.value);
          }}
          onKeyDown={event => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              input.commit();
            }
          }}
          placeholder={t("search_placeholder")}
          type="search"
          value={input.value}
        />
        <NativeSelect
          aria-label={t("board_label")}
          onChange={event => {
            const board = Number(event.target.value);
            update({ board: board > 0 ? board : undefined });
          }}
          value={String(search.board ?? "")}
        >
          <NativeSelectOption value="">{t("all_boards")}</NativeSelectOption>
          {boards.map(board => (
            <NativeSelectOption key={board.id} value={String(board.id)}>
              {`${"— ".repeat(board.depth - 1)}${board.name}`}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label={t("sort_label")}
          onChange={event => {
            update({
              sort: discussionList.sorts.find(
                sort => sort === event.target.value,
              ),
            });
          }}
          value={search.sort ?? discussionList.defaultSort}
        >
          {discussionList.sorts.map(sort => (
            <NativeSelectOption key={sort} value={sort}>
              {t(`sort.${sort}`)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <ContentListResults
        className="flex flex-col divide-y rounded-lg border"
        empty={
          <ListState
            action={
              <HrefLink
                className={buttonVariants({ variant: "outline" })}
                href={discussionNewHref()}
              >
                {t("new")}
              </HrefLink>
            }
            description={t("empty.desc")}
            icon={<MessagesSquareIcon aria-hidden="true" />}
            title={t("empty.title")}
          />
        }
        error={
          <ListState
            description={t("error.desc")}
            icon={<TriangleAlertIcon aria-hidden="true" />}
            title={t("error.title")}
          />
        }
        getKey={discussion => discussion.id}
        isError={discussions === null}
        isFetching={isPending}
        isFiltered={discussionList.isFiltered(search)}
        itemClassName="flex flex-col gap-2 p-4 md:flex-row md:items-center md:justify-between"
        items={discussions?.edges}
        label={t("title")}
        loading={null}
        noResults={
          <ListState
            action={
              <HrefLink
                className={buttonVariants({ variant: "outline" })}
                href={DISCUSSIONS_HREF}
              >
                {t("no_results.clear")}
              </HrefLink>
            }
            description={t("no_results.desc")}
            icon={<SearchXIcon aria-hidden="true" />}
            title={t("no_results.title")}
          />
        }
        renderItem={discussion => {
          const titleId = `discussion-${discussion.id}-title`;

          return (
            <>
              <div className="flex min-w-0 flex-col gap-1">
                {discussion.slug === null ? (
                  <span
                    className="text-foreground font-medium text-balance"
                    id={titleId}
                  >
                    {discussion.title}
                  </span>
                ) : (
                  <HrefLink
                    className="text-foreground font-medium text-balance hover:underline"
                    href={discussionHref(discussion.slug)}
                    id={titleId}
                  >
                    {discussion.title}
                  </HrefLink>
                )}
                <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-sm leading-relaxed">
                  {discussion.author ? (
                    <UserFormat format user={discussion.author} />
                  ) : (
                    <span>{t("deleted_user")}</span>
                  )}
                  {discussion.publishedAt ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <time
                        dateTime={new Date(
                          discussion.publishedAt,
                        ).toISOString()}
                      >
                        <DateFormat date={discussion.publishedAt} />
                      </time>
                    </>
                  ) : null}
                </p>
              </div>
              <DiscussionActions
                can={permissions.of(discussion.id)}
                describedBy={titleId}
                id={discussion.id}
                size="sm"
                title={discussion.title}
              />
            </>
          );
        }}
      />

      {discussions ? (
        <ContentListPagination
          hrefFor={page =>
            discussionList.href(DISCUSSIONS_HREF, { ...search, page })
          }
          label={t("pagination")}
          pageInfo={discussions.pageInfo}
        />
      ) : null}
    </div>
  );
};

export default DiscussionsPage;
