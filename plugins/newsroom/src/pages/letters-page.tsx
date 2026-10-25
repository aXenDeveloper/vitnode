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

import type { LetterListSearch } from "./letter-list";

import { desksQueryOptions } from "./desk-queries";
import { LetterActions } from "./letter-actions";
import {
  letterList,
  LETTERS_HREF,
  lettersQueryOptions,
  useLetterPermissions,
} from "./letter-list";
import { letterHref, letterNewHref } from "./letter-search";

const loadLetters = async (
  queryClient: RouteLoadContext["queryClient"],
  { locale, search }: { locale: string; search: LetterListSearch },
) => {
  // A failed list is an error state on the page, not an error page.
  const [letters, desks] = await Promise.all([
    queryClient
      .query({
        ...lettersQueryOptions({ locale, search }),
        meta: LOADER_DATA_QUERY_META,
      })
      .catch(() => null),
    queryClient.query(desksQueryOptions()).catch(() => []),
  ]);

  return { desks, letters };
};

type LettersPageData = Awaited<ReturnType<typeof loadLetters>>;

export const route = defineRoute<LettersPageData, LetterListSearch>({
  load: async ({ context, search }) =>
    await loadLetters(context.queryClient, {
      locale: context.locale,
      search,
    }),

  head: ({ search, t }) =>
    contentListPageHead({
      description: t("newsroom.letters.list.desc"),
      pathname: LETTERS_HREF,
      search,
      title: t("newsroom.letters.list.title"),
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

const LettersPage = ({
  loaderData: { desks, letters },
  navigate,
  search,
}: PluginRoutePageProps<LettersPageData, LetterListSearch>) => {
  const t = useTranslations("newsroom.letters.list");
  const permissions = useLetterPermissions(
    letters?.edges.map(letter => letter.id) ?? [],
  );
  const [isPending, startTransition] = React.useTransition();
  const update = (patch: Partial<LetterListSearch>) => {
    startTransition(async () => {
      await navigate({
        resetScroll: false,
        search: letterList.withSearch(search, patch),
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
          href={letterNewHref(search.desk)}
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
          aria-label={t("desk_label")}
          onChange={event => {
            const desk = Number(event.target.value);
            update({ desk: desk > 0 ? desk : undefined });
          }}
          value={String(search.desk ?? "")}
        >
          <NativeSelectOption value="">{t("all_desks")}</NativeSelectOption>
          {desks.map(desk => (
            <NativeSelectOption key={desk.id} value={String(desk.id)}>
              {`${"— ".repeat(desk.depth - 1)}${desk.name}`}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label={t("sort_label")}
          onChange={event => {
            update({
              sort: letterList.sorts.find(sort => sort === event.target.value),
            });
          }}
          value={search.sort ?? letterList.defaultSort}
        >
          {letterList.sorts.map(sort => (
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
                href={letterNewHref()}
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
        getKey={letter => letter.id}
        isError={letters === null}
        isFetching={isPending}
        isFiltered={letterList.isFiltered(search)}
        itemClassName="flex flex-col gap-2 p-4 md:flex-row md:items-center md:justify-between"
        items={letters?.edges}
        label={t("title")}
        loading={null}
        noResults={
          <ListState
            action={
              <HrefLink
                className={buttonVariants({ variant: "outline" })}
                href={LETTERS_HREF}
              >
                {t("no_results.clear")}
              </HrefLink>
            }
            description={t("no_results.desc")}
            icon={<SearchXIcon aria-hidden="true" />}
            title={t("no_results.title")}
          />
        }
        renderItem={letter => {
          const titleId = `letter-${letter.id}-title`;

          return (
            <>
              <div className="flex min-w-0 flex-col gap-1">
                {letter.slug === null ? (
                  <span
                    className="text-foreground font-medium text-balance"
                    id={titleId}
                  >
                    {letter.title}
                  </span>
                ) : (
                  <HrefLink
                    className="text-foreground font-medium text-balance hover:underline"
                    href={letterHref(letter.slug)}
                    id={titleId}
                  >
                    {letter.title}
                  </HrefLink>
                )}
                <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-sm leading-relaxed">
                  {letter.author ? (
                    <UserFormat format user={letter.author} />
                  ) : (
                    <span>{t("deleted_user")}</span>
                  )}
                  {letter.publishedAt ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <time
                        dateTime={new Date(letter.publishedAt).toISOString()}
                      >
                        <DateFormat date={letter.publishedAt} />
                      </time>
                    </>
                  ) : null}
                </p>
              </div>
              <LetterActions
                can={permissions.of(letter.id)}
                describedBy={titleId}
                id={letter.id}
                size="sm"
                title={letter.title}
              />
            </>
          );
        }}
      />

      {letters ? (
        <ContentListPagination
          hrefFor={page => letterList.href(LETTERS_HREF, { ...search, page })}
          label={t("pagination")}
          pageInfo={letters.pageInfo}
        />
      ) : null}
    </div>
  );
};

export default LettersPage;
