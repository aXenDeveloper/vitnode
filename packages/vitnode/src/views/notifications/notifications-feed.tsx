import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "cn";
import {
  AtSignIcon,
  BellIcon,
  BellOffIcon,
  CheckCheckIcon,
  RotateCwIcon,
} from "lucide-react";
import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import React from "react";
import { useTranslations } from "use-intl";

import { MotionFeatures } from "@/components/motion-features";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { glideSidebarIndicators } from "@/components/ui/sidebar-glide";
import { Skeleton } from "@/components/ui/skeleton";

import type { NotificationItemProps } from "./notification-item";
import type {
  NotificationItemView,
  NotificationsFeedFilter,
} from "./notifications-query";

import { NotificationItem } from "./notification-item";

const ROW_ESTIMATE_PX = 72;
const INITIAL_RECT = { height: 448, width: 384 };
const LOAD_MORE_THRESHOLD = 4;
const ROW_MOTION_WINDOW_MS = 400;
const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;
const ROW_TRANSITION = {
  layout: { type: "spring", duration: 0.35, bounce: 0, delay: 0.06 },
  opacity: { duration: 0.25, ease: EASE_OUT },
} as const;
const ROW_SETTLED_TRANSITION = {
  ...ROW_TRANSITION,
  layout: { duration: 0 },
} as const;
const ROW_REMOVED_EXIT = {
  opacity: 0,
  scale: 0.98,
  transition: { duration: 0.12, ease: EASE_IN },
};
const ROW_SCROLLED_AWAY_EXIT = { transition: { duration: 0 } };

const rowExitVariants = (id: number | undefined) => ({
  exit: (removed: ReadonlySet<number>) =>
    id !== undefined && removed.has(id)
      ? ROW_REMOVED_EXIT
      : ROW_SCROLLED_AWAY_EXIT,
});

const isAppendOnly = (previous: readonly number[], next: readonly number[]) =>
  previous.every((id, index) => next[index] === id);

const EMPTY_IDS: ReadonlySet<number> = new Set();

const useRowMotion = (ids: readonly number[]) => {
  const [previousIds, setPreviousIds] = React.useState(ids);
  const [entering, setEntering] = React.useState(EMPTY_IDS);
  const [removed, setRemoved] = React.useState(EMPTY_IDS);
  const [isShifting, setIsShifting] = React.useState(false);

  if (previousIds !== ids) {
    const before = new Set(previousIds);
    const after = new Set(ids);
    setPreviousIds(ids);
    setEntering(new Set(ids.filter(id => !before.has(id))));
    setRemoved(new Set(previousIds.filter(id => !after.has(id))));
    setIsShifting(previousIds.length > 0 && !isAppendOnly(previousIds, ids));
  }

  React.useEffect(() => {
    if (entering.size === 0 && removed.size === 0 && !isShifting) return;
    const timeout = window.setTimeout(() => {
      setEntering(EMPTY_IDS);
      setRemoved(EMPTY_IDS);
      setIsShifting(false);
    }, ROW_MOTION_WINDOW_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [entering, isShifting, removed]);

  return { entering, isShifting, removed };
};

export interface NotificationsFeedState {
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isError: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  isPending: boolean;
  items: NotificationItemView[];
  refetch: () => void;
}

const RowSkeleton = () => (
  <div aria-hidden className="flex items-start gap-3 p-2">
    <Skeleton className="size-9 rounded-full" />
    <div className="flex flex-1 flex-col gap-2 pt-1">
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-3 w-1/4" />
    </div>
  </div>
);

const EMPTY_ICONS: Record<NotificationsFeedFilter, React.ReactNode> = {
  all: <BellIcon aria-hidden="true" />,
  mentions: <AtSignIcon aria-hidden="true" />,
  unread: <CheckCheckIcon aria-hidden="true" />,
};

const LoadMoreRow = ({ feed }: { feed: NotificationsFeedState }) => {
  const t = useTranslations("core.global.notifications");

  if (!feed.isFetchNextPageError) return <RowSkeleton />;

  return (
    <div className="flex items-center justify-between gap-2 p-2" role="alert">
      <span className="text-muted-foreground text-sm leading-relaxed">
        {t("load_more_error")}
      </span>
      <Button
        isLoading={feed.isFetchingNextPage}
        onClick={feed.fetchNextPage}
        size="sm"
        variant="outline"
      >
        <RotateCwIcon aria-hidden="true" />
        {t("retry")}
      </Button>
    </div>
  );
};

/**
 * The bell dropdown's notification list: virtualized rows that load the next
 * page as the end scrolls into view, with skeleton, empty (per filter) and
 * error states.
 */
export const NotificationsFeed = ({
  className,
  feed,
  filter,
  label,
  ...itemActions
}: Omit<NotificationItemProps, "item"> & {
  className?: string;
  feed: NotificationsFeedState;
  filter: NotificationsFeedFilter;
  label: string;
}) => {
  const t = useTranslations("core.global.notifications");
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const attachScrollArea = React.useCallback((node: HTMLDivElement | null) => {
    scrollRef.current = node;
    if (!node) return;
    const stopGlide = glideSidebarIndicators(node);

    return () => {
      stopGlide();
      scrollRef.current = null;
    };
  }, []);
  const { items } = feed;
  const ids = React.useMemo(() => items.map(item => item.id), [items]);
  const rowMotion = useRowMotion(ids);
  const shouldReduceMotion = useReducedMotion();
  const hasLoadMoreRow = feed.hasNextPage || feed.isFetchNextPageError;

  const virtualizer = useVirtualizer({
    count: items.length + (hasLoadMoreRow ? 1 : 0),
    estimateSize: () => ROW_ESTIMATE_PX,
    getItemKey: index => items.at(index)?.id ?? "load-more",
    getScrollElement: () => scrollRef.current,
    initialRect: INITIAL_RECT,
    overscan: 6,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const lastIndex = virtualItems.at(-1)?.index ?? -1;
  const {
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = feed;

  React.useEffect(() => {
    if (
      lastIndex >= items.length - LOAD_MORE_THRESHOLD &&
      hasNextPage &&
      !isFetchingNextPage &&
      !isFetchNextPageError
    ) {
      fetchNextPage();
    }
  }, [
    fetchNextPage,
    hasNextPage,
    isFetchNextPageError,
    isFetchingNextPage,
    items.length,
    lastIndex,
  ]);

  if (feed.isPending) {
    return (
      <div aria-busy className={cn("overflow-hidden p-1.5", className)}>
        <span className="sr-only" role="status">
          {t("loading")}
        </span>
        {Array.from({ length: 6 }, (_, index) => (
          <RowSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (feed.isError && items.length === 0) {
    return (
      <Empty className={cn("p-6", className)} role="alert">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BellOffIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{t("load_error.title")}</EmptyTitle>
          <EmptyDescription>{t("load_error.desc")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            isLoading={feed.isFetching}
            onClick={feed.refetch}
            size="sm"
            variant="outline"
          >
            <RotateCwIcon aria-hidden="true" />
            {t("retry")}
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  if (items.length === 0) {
    return (
      <Empty className={cn("p-6", className)}>
        <EmptyHeader>
          <EmptyMedia variant="icon">{EMPTY_ICONS[filter]}</EmptyMedia>
          <EmptyTitle>{t(`empty.${filter}.title`)}</EmptyTitle>
          <EmptyDescription>{t(`empty.${filter}.desc`)}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div
      aria-busy={feed.isFetching}
      className={cn(
        "group/feed relative overflow-y-auto overscroll-contain p-1.5",
        className,
      )}
      ref={attachScrollArea}
    >
      <span
        aria-hidden
        className="bg-accent/70 ease-fluid pointer-events-none absolute top-0 left-0 rounded-md opacity-0 transition-[translate,width,height,opacity,scale] duration-200 data-hidden:duration-150 data-pressed:scale-98 motion-reduce:transition-opacity"
        data-sidebar="hover-indicator"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 opacity-0"
        data-sidebar="active-indicator"
      />
      <MotionFeatures withLayoutAndDrag>
        <ul
          aria-label={label}
          className="relative w-full"
          style={{ height: virtualizer.getTotalSize() }}
        >
          {shouldReduceMotion ? (
            virtualItems.map(virtualItem => {
              const item = items.at(virtualItem.index);

              return (
                <li
                  className="absolute left-0 w-full"
                  data-index={virtualItem.index}
                  key={virtualItem.key}
                  ref={virtualizer.measureElement}
                  style={{ top: virtualItem.start }}
                >
                  {item ? (
                    <NotificationItem item={item} {...itemActions} />
                  ) : (
                    <LoadMoreRow feed={feed} />
                  )}
                </li>
              );
            })
          ) : (
            <AnimatePresence custom={rowMotion.removed} initial={false}>
              {virtualItems.map(virtualItem => {
                const item = items.at(virtualItem.index);

                return (
                  <m.li
                    animate={{ opacity: 1 }}
                    className="absolute left-0 w-full"
                    data-index={virtualItem.index}
                    exit="exit"
                    initial={
                      item && rowMotion.entering.has(item.id)
                        ? { opacity: 0 }
                        : false
                    }
                    key={virtualItem.key}
                    layout="position"
                    ref={virtualizer.measureElement}
                    style={{ top: virtualItem.start }}
                    transition={
                      rowMotion.isShifting
                        ? ROW_TRANSITION
                        : ROW_SETTLED_TRANSITION
                    }
                    variants={rowExitVariants(item?.id)}
                  >
                    {item ? (
                      <NotificationItem item={item} {...itemActions} />
                    ) : (
                      <LoadMoreRow feed={feed} />
                    )}
                  </m.li>
                );
              })}
            </AnimatePresence>
          )}
        </ul>
      </MotionFeatures>
    </div>
  );
};
