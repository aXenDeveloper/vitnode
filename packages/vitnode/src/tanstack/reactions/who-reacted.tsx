import type { ContentTarget } from "@vitnode/api/content/target";

import { useInfiniteQuery } from "@tanstack/react-query";
import { RotateCwIcon, SmileIcon } from "lucide-react";
import React from "react";
import { useLocale, useTranslations } from "use-intl";

import { Avatar } from "@/components/avatar";
import { DateFormat } from "@/components/date-format";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { UserFormat } from "@/components/user-format";
import { UserPreview, UserPreviewProvider } from "@/components/user-preview";

import type { ReactionCatalogItem } from "./query";

import { reactionTitle, whoReactedQueryOptions } from "./query";
import { ReactionIcon } from "./reaction-icon";

const ALL = "__all";

/** Who reacted to one item, filterable by reaction. Lazy-loaded by `ReactionBar`. */
const WhoReactedSheet = ({
  catalog,
  counts,
  initialFilter,
  onOpenChange,
  open,
  target,
  total,
}: {
  catalog: ReactionCatalogItem[];
  counts: { code: string; count: number }[];
  initialFilter?: null | string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  target: ContentTarget;
  total: number;
}) => {
  const t = useTranslations("core.reactions");
  const locale = useLocale();
  const [filter, setFilter] = React.useState<string>(initialFilter ?? ALL);
  const query = useInfiniteQuery(
    whoReactedQueryOptions(target, filter === ALL ? null : filter),
  );
  const byCode = new Map(catalog.map(item => [item.code, item]));
  const edges = query.data?.pages.flatMap(page => page.edges) ?? [];

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-sm">
        <SheetHeader className="border-b p-4">
          <SheetTitle>{t("who.title")}</SheetTitle>
          <SheetDescription>{t("who.desc", { count: total })}</SheetDescription>
        </SheetHeader>

        <div className="border-b px-4 py-2">
          <ToggleGroup
            aria-label={t("who.filter")}
            className="flex-wrap"
            onValueChange={value => {
              const [next] = value;
              if (next) setFilter(next);
            }}
            size="sm"
            spacing={1}
            value={[filter]}
            variant="outline"
          >
            <ToggleGroupItem value={ALL}>
              {t("who.all")} <span className="tabular-nums">{total}</span>
            </ToggleGroupItem>
            {counts.flatMap(({ code, count }) => {
              const item = byCode.get(code);
              if (!item) return [];

              return [
                <ToggleGroupItem
                  aria-label={t("pill", {
                    count,
                    reaction: reactionTitle(item, locale),
                  })}
                  key={code}
                  value={code}
                >
                  <ReactionIcon reaction={item} />
                  <span className="tabular-nums">{count}</span>
                </ToggleGroupItem>,
              ];
            })}
          </ToggleGroup>
        </div>

        <div
          aria-busy={query.isFetching}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2"
        >
          {query.isPending ? (
            <ul aria-hidden="true" className="flex flex-col gap-1 p-2">
              {Array.from({ length: 5 }, (_, index) => (
                <li className="flex items-center gap-3 py-1.5" key={index}>
                  <Skeleton className="size-8 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                </li>
              ))}
            </ul>
          ) : query.isError ? (
            <Empty role="alert">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SmileIcon aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>{t("who.load_error.title")}</EmptyTitle>
                <EmptyDescription>{t("who.load_error.desc")}</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button
                  isLoading={query.isFetching}
                  onClick={() => void query.refetch()}
                  variant="outline"
                >
                  <RotateCwIcon aria-hidden="true" />
                  {t("retry")}
                </Button>
              </EmptyContent>
            </Empty>
          ) : edges.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SmileIcon aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>{t("who.empty_title")}</EmptyTitle>
                <EmptyDescription>{t("who.empty_desc")}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              <UserPreviewProvider>
                <ul className="flex flex-col">
                  {edges.map(edge => {
                    const item = byCode.get(edge.reaction);

                    return (
                      <li
                        className="flex items-center gap-3 rounded-lg px-2 py-1.5"
                        key={`${edge.user.id}-${edge.reaction}`}
                      >
                        <span className="relative shrink-0">
                          <UserPreview
                            className="flex rounded-full"
                            decorative
                            nameCode={edge.user.nameCode}
                          >
                            <Avatar
                              alt=""
                              className="size-8"
                              size={32}
                              user={edge.user}
                            />
                          </UserPreview>
                          {item ? (
                            <span className="bg-background absolute -end-1 -bottom-1 flex size-5 items-center justify-center rounded-full border">
                              <ReactionIcon
                                className="size-3.5 text-xs"
                                reaction={item}
                              />
                            </span>
                          ) : null}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <UserFormat
                            className="min-w-0 truncate text-sm"
                            format
                            link
                            user={edge.user}
                          />
                          <span className="text-muted-foreground text-xs">
                            {item ? reactionTitle(item, locale) : edge.reaction}
                            {" · "}
                            <DateFormat date={edge.createdAt} />
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </UserPreviewProvider>
              {query.hasNextPage ? (
                <Button
                  className="m-2"
                  isLoading={query.isFetchingNextPage}
                  onClick={() => void query.fetchNextPage()}
                  variant="outline"
                >
                  {t("who.load_more")}
                </Button>
              ) : null}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default WhoReactedSheet;
