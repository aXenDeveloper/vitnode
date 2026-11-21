import type { ContentTarget } from "@vitnode/api/content/target";

import { useInfiniteQuery } from "@tanstack/react-query";
import { RotateCwIcon } from "lucide-react";
import React from "react";
import { useLocale, useTranslations } from "use-intl";

import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { ShortNumber } from "@/components/ui/short-number";
import { Skeleton } from "@/components/ui/skeleton";
import { UserFormat } from "@/components/user-format";

import type { ReactionCatalogItem } from "./query";

import { reactionTitle, whoReactedQueryOptions } from "./query";
import { ReactionIcon } from "./reaction-icon";

const PEEK_SIZE = 5;

const PeekPeople = ({
  code,
  count,
  target,
}: {
  code: string;
  count: number;
  target: ContentTarget;
}) => {
  const t = useTranslations("core.reactions");
  const query = useInfiniteQuery(whoReactedQueryOptions(target, code));

  if (query.isPending) {
    return (
      <ul aria-hidden="true" className="flex flex-col">
        {Array.from({ length: Math.min(count, PEEK_SIZE) }, (_, index) => (
          <li className="flex items-center gap-2.5 py-1" key={index}>
            <Skeleton className="size-7 rounded-full" />
            <Skeleton className="h-4 w-28" />
          </li>
        ))}
      </ul>
    );
  }

  if (query.isError) {
    return (
      <div
        className="text-muted-foreground flex items-center justify-between gap-2 text-sm"
        role="alert"
      >
        <span>{t("who.load_error.title")}</span>
        <Button
          isLoading={query.isFetching}
          onClick={() => void query.refetch()}
          size="xs"
          variant="ghost"
        >
          <RotateCwIcon aria-hidden="true" />
          {t("retry")}
        </Button>
      </div>
    );
  }

  const edges = query.data.pages[0]?.edges.slice(0, PEEK_SIZE) ?? [];

  return (
    <ul className="flex flex-col">
      {edges.map(edge => (
        <li
          className="flex min-w-0 items-center gap-2.5 py-1"
          key={edge.user.id}
        >
          <Avatar
            alt=""
            className="size-7 shrink-0"
            size={28}
            user={edge.user}
          />
          <UserFormat
            className="min-w-0 truncate text-sm"
            format
            link
            preview={false}
            user={edge.user}
          />
        </li>
      ))}
    </ul>
  );
};

/**
 * A reaction pill's hover card: who gave this reaction, the first few by
 * name, and a link to the full list. Loads the names when it opens.
 */
export const ReactionPeek = ({
  count,
  hint,
  onSeeAll,
  reaction,
  target,
  total,
  trigger,
}: {
  count: number;
  /** What clicking the pill does, such as "Click the pill to react". */
  hint: null | string;
  onSeeAll: () => void;
  reaction: ReactionCatalogItem;
  target: ContentTarget;
  /** Every reaction on the item, to offer the full list when there is more. */
  total: number;
  trigger: React.ReactElement;
}) => {
  const t = useTranslations("core.reactions");
  const locale = useLocale();
  const [open, setOpen] = React.useState(false);
  const showSeeAll = count > PEEK_SIZE || total > count;

  return (
    <HoverCard onOpenChange={setOpen} open={open}>
      <HoverCardTrigger closeDelay={150} delay={350} render={trigger} />
      <HoverCardContent
        align="start"
        className="flex w-72 flex-col gap-2 p-3"
        side="top"
      >
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <ReactionIcon reaction={reaction} />
          {reactionTitle(reaction, locale)}
          <span className="text-muted-foreground font-normal">
            · <ShortNumber value={count} />
          </span>
        </p>
        {open ? (
          <PeekPeople code={reaction.code} count={count} target={target} />
        ) : null}
        {hint || showSeeAll ? (
          <div className="flex items-center justify-between gap-3 border-t pt-2">
            <span className="text-muted-foreground text-xs leading-relaxed">
              {hint}
            </span>
            {showSeeAll ? (
              <Button
                aria-haspopup="dialog"
                className="h-auto shrink-0 p-0 text-xs"
                onClick={() => {
                  setOpen(false);
                  onSeeAll();
                }}
                variant="link"
              >
                {count > PEEK_SIZE
                  ? t("peek.see_all", { count })
                  : t("peek.see_everyone")}
              </Button>
            ) : null}
          </div>
        ) : null}
      </HoverCardContent>
    </HoverCard>
  );
};
