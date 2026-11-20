import type { ContentTarget } from "@vitnode/api/content/target";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import { RotateCwIcon, SmilePlusIcon } from "lucide-react";
import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import React from "react";
import { toast } from "sonner";
import { useFormatter, useLocale, useTranslations } from "use-intl";

import { MotionFeatures } from "@/components/motion-features";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { SlidingNumber } from "@/components/ui/sliding-number";
import { TooltipGroup, TooltipWithContent } from "@/components/ui/tooltip";

import type {
  ReactionCatalogItem,
  ReactionsCatalog,
  ReactionSummary,
} from "./query";

import { useSessionQuery } from "../auth/session-query";
import { RouteMessages } from "../i18n/route-messages";
import { useReactionsLive } from "./live";
import { assignPillSlots, nextPillSlots, type PillSlot } from "./pill-slots";
import {
  optimisticToggle,
  REACTIONS_QUERY_ROOT,
  reactionsCatalogQueryOptions,
  ReactionsRequestError,
  reactionSummaryQueryKey,
  reactionSummaryQueryOptions,
  reactionTitle,
  toggleReaction,
} from "./query";
import {
  popReactionIcon,
  REACTION_ICON_ATTRIBUTE,
  ReactionFlight,
  type ReactionFlightPlan,
} from "./reaction-flight";
import { ReactionIcon } from "./reaction-icon";
import { ReactionPeek } from "./reaction-peek";

const WhoReactedSheet = React.lazy(async () => await import("./who-reacted"));

/** The message namespaces the reaction bar renders with. */
export const REACTIONS_NAMESPACES = ["core.global", "core.reactions"] as const;

export interface ReactionBarProps {
  className?: string;
  /**
   * Hide the bar's own read for a record you already know nobody can react
   * to (`canReact` from a permissions read is `false` and it has no counts).
   * Defaults to `true`.
   */
  enabled?: boolean;
  /**
   * What the member reacts to. For a content type with `reactions`, build it
   * with `contentTarget` from `@vitnode/core/content`; for a custom target,
   * `{ pluginId, type, id }` as registered with `defineReactionTarget`.
   */
  target: ContentTarget;
}

const TOAST_ERROR_CODES = [
  "daily_limit",
  "item_limit",
  "locked",
  "not_found",
  "reacting_disabled",
  "reaction_daily_limit",
  "reaction_not_allowed",
  "self_reaction",
  "sign_in",
] as const;

type ToastErrorCode = (typeof TOAST_ERROR_CODES)[number];

const toastErrorCodes: ReadonlySet<string> = new Set(TOAST_ERROR_CODES);

const isToastErrorCode = (code: string): code is ToastErrorCode =>
  toastErrorCodes.has(code);

interface WhoState {
  filter: null | string;
}

const PILL_HIDDEN = {
  marginInlineEnd: "-0.25rem",
  opacity: 0,
  overflow: "hidden",
  scale: 0.8,
  width: 0,
} as const;

const PILL_SHOWN = {
  marginInlineEnd: "0rem",
  opacity: 1,
  scale: 1,
  transitionEnd: { overflow: "visible" },
  width: "auto",
} as const;

const PILL_ENTER_TRANSITION = {
  default: { bounce: 0, duration: 0.32, type: "spring" },
  opacity: { duration: 0.16, ease: "easeOut" },
  scale: { bounce: 0, duration: 0.32, type: "spring" },
} as const;

const PILL_EXIT_TRANSITION = {
  default: { bounce: 0, duration: 0.24, type: "spring" },
  opacity: { duration: 0.12, ease: "easeIn" },
  scale: { duration: 0.16, ease: "easeIn" },
} as const;

const useToggle = (
  target: ContentTarget,
  viewerId: null | number,
  maxPerItem: null | number,
) => {
  const queryClient = useQueryClient();
  const t = useTranslations("core.reactions");
  const format = useFormatter();
  const locale = useLocale();
  const key = reactionSummaryQueryKey(target, viewerId);

  return useMutation({
    mutationFn: async ({ code, remove }: { code: string; remove: boolean }) =>
      await toggleReaction(target, { code, remove }),
    onMutate: async ({ code }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ReactionSummary>(key);
      if (previous) {
        queryClient.setQueryData(
          key,
          optimisticToggle(previous, code, maxPerItem),
        );
      }

      return { previous };
    },
    onError: (error, { code }, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      const catalog = queryClient.getQueryData(
        reactionsCatalogQueryOptions(viewerId).queryKey,
      );
      const item = catalog?.items.find(entry => entry.code === code);
      const reaction = item ? reactionTitle(item, locale) : code;
      const errorCode =
        error instanceof ReactionsRequestError && isToastErrorCode(error.code)
          ? error.code
          : null;
      const time =
        error instanceof ReactionsRequestError && error.resetsAt
          ? format.relativeTime(new Date(error.resetsAt))
          : "";

      toast.error(t("errors.title"), {
        description: errorCode
          ? t(`errors.${errorCode}`, { reaction, time })
          : t("errors.generic"),
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: [...REACTIONS_QUERY_ROOT, "catalog"],
      });
    },
    onSuccess: summary => {
      queryClient.setQueryData<ReactionSummary>(key, current =>
        current && current.seq > summary.seq
          ? { ...current, viewer: summary.viewer }
          : summary,
      );
    },
  });
};

const Picker = ({
  catalog,
  disabled,
  onPick,
  summary,
}: {
  catalog: {
    items: ReactionCatalogItem[];
    maxPerItem: null | number;
  };
  disabled: boolean;
  onPick: (code: string, origin: DOMRect | null) => void;
  summary: ReactionSummary;
}) => {
  const t = useTranslations("core.reactions");
  const locale = useLocale();
  const [open, setOpen] = React.useState(false);
  const [picked, setPicked] = React.useState<null | string>(null);
  const usable = catalog.items.filter(item => item.usable);
  const chosen = new Set(summary.viewer);
  const atCap =
    catalog.maxPerItem !== null &&
    catalog.maxPerItem > 1 &&
    summary.viewer.length >= catalog.maxPerItem;

  if (usable.length === 0) return null;

  return (
    <Popover
      onOpenChange={next => {
        if (next) setPicked(null);
        setOpen(next);
      }}
      open={open}
    >
      <TooltipWithContent text={t("add")}>
        <PopoverTrigger
          render={
            <Button
              aria-label={t("add")}
              className="text-muted-foreground size-7 rounded-full"
              disabled={disabled}
              size="icon-xs"
              variant="ghost"
            />
          }
        >
          <SmilePlusIcon aria-hidden="true" className="size-4.5" />
        </PopoverTrigger>
      </TooltipWithContent>
      <PopoverContent
        align="start"
        className="w-auto max-w-[min(20rem,calc(100vw-2rem))] p-2"
      >
        <PopoverHeader className="sr-only">
          <PopoverTitle>{t("picker_title")}</PopoverTitle>
        </PopoverHeader>
        <TooltipGroup>
          <ul aria-label={t("picker_title")} className="flex flex-wrap gap-1">
            {usable.map((item, index) => {
              const title = reactionTitle(item, locale);
              const mine = chosen.has(item.code);
              const usedUp = !mine && item.remainingToday === 0;
              const blocked = !mine && atCap;
              const hint = usedUp
                ? t("used_up")
                : blocked
                  ? t("remove_one_first")
                  : item.remainingToday !== null && !mine
                    ? t("left_today", { count: item.remainingToday })
                    : null;

              return (
                <li
                  className="motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-75 motion-safe:fill-mode-both motion-safe:ease-fluid motion-safe:duration-200"
                  key={item.code}
                  style={{ animationDelay: `${index * 18}ms` }}
                >
                  <TooltipWithContent
                    text={hint ? `${title} · ${hint}` : title}
                  >
                    <Button
                      aria-label={hint ? `${title}, ${hint}` : title}
                      aria-pressed={mine}
                      className={cn(
                        "size-10 rounded-xl",
                        mine && "bg-primary/10 ring-primary/40 ring-1",
                      )}
                      disabled={usedUp || blocked}
                      onClick={event => {
                        const icon = event.currentTarget.querySelector(
                          `[${REACTION_ICON_ATTRIBUTE}]`,
                        );
                        setPicked(item.code);
                        setOpen(false);
                        onPick(
                          item.code,
                          icon?.getBoundingClientRect() ?? null,
                        );
                      }}
                      size="icon"
                      variant="ghost"
                    >
                      <span
                        className={cn(
                          "ease-fluid inline-flex duration-150 motion-safe:transition-transform motion-safe:group-hover/button:scale-120",
                          picked === item.code && "invisible",
                        )}
                        data-reaction-icon={item.code}
                      >
                        <ReactionIcon
                          className="size-6 text-2xl"
                          reaction={item}
                        />
                      </span>
                    </Button>
                  </TooltipWithContent>
                </li>
              );
            })}
          </ul>
        </TooltipGroup>
      </PopoverContent>
    </Popover>
  );
};

const peekHintKey = ({
  mine,
  opensWho,
}: {
  mine: boolean;
  opensWho: boolean;
}) => {
  if (opensWho || mine) return null;

  return "peek.hint_add";
};

const useCountFormatter = (count: number) => {
  const locale = useLocale();
  const formatters = React.useMemo(
    () => ({
      compact: new Intl.NumberFormat(locale, {
        compactDisplay: "short",
        maximumFractionDigits: 1,
        notation: "compact",
      }),
      full: new Intl.NumberFormat(locale),
    }),
    [locale],
  );

  return count < 1000 ? formatters.full : formatters.compact;
};

const usePopWhenChosen = (
  icon: React.RefObject<HTMLSpanElement | null>,
  mine: boolean,
  flying: boolean,
) => {
  const wasMine = React.useRef(mine);

  React.useLayoutEffect(() => {
    const chosenNow = mine && !wasMine.current;
    wasMine.current = mine;
    if (chosenNow && !flying) popReactionIcon(icon.current);
  }, [flying, icon, mine]);
};

/**
 * One reaction's pill. It toggles the reaction when the viewer may press it
 * and opens "who reacted" when a member may not. A guest only sees the count.
 */
const ReactionPill = ({
  busy,
  canAct,
  count,
  flying,
  item,
  mine,
  onPick,
  onShowWho,
  signedIn,
  target,
  total,
}: {
  busy: boolean;
  canAct: boolean;
  count: number;
  flying: boolean;
  item: ReactionCatalogItem;
  mine: boolean;
  onPick: () => void;
  onShowWho: () => void;
  signedIn: boolean;
  target: ContentTarget;
  total: number;
}) => {
  const t = useTranslations("core.reactions");
  const locale = useLocale();
  const title = reactionTitle(item, locale);
  const label = t(mine ? "pill_mine" : "pill", { count, reaction: title });
  const pressable =
    canAct && (mine || (item.usable && item.remainingToday !== 0));
  const opensWho = signedIn && !pressable;
  const hintKey = peekHintKey({ mine, opensWho });
  const iconRef = React.useRef<HTMLSpanElement>(null);
  const formatter = useCountFormatter(count);
  usePopWhenChosen(iconRef, mine, flying);

  if (!signedIn) {
    return (
      <span
        className={cn(
          buttonVariants({ size: "xs", variant: "outline" }),
          "text-muted-foreground pointer-events-none h-7 gap-1 rounded-full px-2 tabular-nums",
        )}
      >
        <span className="sr-only">{label}</span>
        <span aria-hidden="true" className="inline-flex">
          <ReactionIcon reaction={item} />
        </span>
        <SlidingNumber
          aria-hidden="true"
          className="text-xs font-medium"
          formatter={formatter}
          value={count}
        />
      </span>
    );
  }

  const pill = (
    <Button
      aria-haspopup={opensWho ? "dialog" : undefined}
      aria-label={
        opensWho
          ? `${label}, ${t("pill_hint_who", { reaction: title })}`
          : label
      }
      aria-pressed={opensWho ? undefined : mine}
      className={cn(
        "h-7 gap-1 rounded-full px-2 tabular-nums",
        mine
          ? "border-primary/40 bg-primary/10 text-foreground hover:bg-primary/15 aria-expanded:bg-primary/15 dark:border-primary/40 dark:bg-primary/10 dark:hover:bg-primary/15"
          : "text-muted-foreground",
      )}
      disabled={busy && !opensWho}
      onClick={opensWho ? onShowWho : onPick}
      size="xs"
      variant="outline"
    >
      <span
        className={cn("inline-flex", flying && "invisible")}
        data-reaction-icon={item.code}
        ref={iconRef}
      >
        <ReactionIcon reaction={item} />
      </span>
      <SlidingNumber
        aria-hidden="true"
        className="text-xs font-medium"
        formatter={formatter}
        value={count}
      />
    </Button>
  );

  return (
    <ReactionPeek
      count={count}
      hint={hintKey ? t(hintKey) : null}
      onSeeAll={onShowWho}
      reaction={item}
      target={target}
      total={total}
      trigger={pill}
    />
  );
};

const ReactionBarItems = ({
  catalog,
  onWhoChange,
  pills,
  showPicker,
  signedIn,
  summary,
  target,
  toggle,
  who,
}: {
  catalog: ReactionsCatalog;
  onWhoChange: (who: null | WhoState) => void;
  pills: { count: number; item: ReactionCatalogItem; position: number }[];
  showPicker: boolean;
  signedIn: boolean;
  summary: ReactionSummary;
  target: ContentTarget;
  toggle: ReturnType<typeof useToggle>;
  who: null | WhoState;
}) => {
  const t = useTranslations("core.reactions");
  const shouldReduceMotion = useReducedMotion();
  const listRef = React.useRef<HTMLUListElement>(null);
  const [flight, setFlight] = React.useState<null | ReactionFlightPlan>(null);
  const codes = pills.map(({ item }) => item.code);
  const [slots, setSlots] = React.useState<readonly PillSlot[]>(() =>
    assignPillSlots([], codes),
  );
  const currentSlots = nextPillSlots(slots, codes);
  if (currentSlots !== slots) setSlots(currentSlots);
  const chosen = new Set(summary.viewer);
  const canAct = showPicker && signedIn;
  const busy = toggle.isPending;
  const flightReaction = flight
    ? catalog.items.find(item => item.code === flight.code)
    : undefined;
  const pillTransition = shouldReduceMotion
    ? { duration: 0 }
    : PILL_ENTER_TRANSITION;
  const pillExitTransition = shouldReduceMotion
    ? { duration: 0 }
    : PILL_EXIT_TRANSITION;

  const onPick = (code: string, origin: DOMRect | null = null) => {
    if (busy) return;
    const remove = chosen.has(code);
    if (origin && !remove && !shouldReduceMotion) {
      setFlight(current => ({
        code,
        from: origin,
        id: (current?.id ?? 0) + 1,
      }));
    }
    toggle.mutate({ code, remove });
  };

  return (
    <MotionFeatures>
      <ul
        aria-label={t("label")}
        className="flex flex-wrap items-center gap-1"
        ref={listRef}
      >
        <AnimatePresence initial={false}>
          {pills.map(({ count, item }, index) => (
            <m.li
              animate={PILL_SHOWN}
              className="flex origin-left"
              exit={{ ...PILL_HIDDEN, transition: pillExitTransition }}
              initial={PILL_HIDDEN}
              key={currentSlots[index]?.key ?? item.code}
              transition={pillTransition}
            >
              <ReactionPill
                busy={busy}
                canAct={canAct}
                count={count}
                flying={flight?.code === item.code}
                item={item}
                mine={chosen.has(item.code)}
                onPick={() => {
                  onPick(item.code);
                }}
                onShowWho={() => {
                  onWhoChange({ filter: item.code });
                }}
                signedIn={signedIn}
                target={target}
                total={summary.total}
              />
            </m.li>
          ))}
        </AnimatePresence>
      </ul>
      {flight && flightReaction ? (
        <ReactionFlight
          flight={flight}
          key={flight.id}
          list={listRef}
          onLand={() => {
            setFlight(null);
          }}
          reaction={flightReaction}
        />
      ) : null}
      {canAct ? (
        <Picker
          catalog={catalog}
          disabled={busy}
          onPick={onPick}
          summary={summary}
        />
      ) : null}
      {who ? (
        <React.Suspense fallback={null}>
          <WhoReactedSheet
            catalog={catalog.items}
            counts={summary.counts}
            initialFilter={who.filter}
            onOpenChange={open => {
              if (!open) onWhoChange(null);
            }}
            open
            target={target}
            total={summary.total}
          />
        </React.Suspense>
      ) : null}
    </MotionFeatures>
  );
};

const useReactionBarQueries = (target: ContentTarget, enabled: boolean) => {
  const session = useSessionQuery();
  const viewerId = session.data?.user?.id ?? null;
  const ready = enabled && !session.isPending;
  const catalog = useQuery({
    ...reactionsCatalogQueryOptions(viewerId),
    enabled: ready,
  });
  const summary = useQuery({
    ...reactionSummaryQueryOptions(target, viewerId),
    enabled: ready,
  });

  return { catalog, summary, viewerId };
};

const ReactionBarInner = ({
  className,
  enabled = true,
  target,
}: ReactionBarProps) => {
  const t = useTranslations("core.reactions");
  // Every state below renders its root `div` here, so React keeps one element
  // for `useReactionsLive` to observe.
  const ref = React.useRef<HTMLDivElement>(null);
  const [who, setWho] = React.useState<null | WhoState>(null);
  const { catalog, summary, viewerId } = useReactionBarQueries(target, enabled);
  const toggle = useToggle(target, viewerId, catalog.data?.maxPerItem ?? 1);
  useReactionsLive(target, ref, enabled && Boolean(catalog.data?.live));

  if (!enabled) return null;

  if (summary.isPending || catalog.isPending) {
    return (
      <div
        aria-busy="true"
        className={cn("flex items-center gap-1", className)}
        ref={ref}
      >
        <span className="sr-only" role="status">
          {t("label")}
        </span>
        <Skeleton className="h-7 w-12 rounded-full" />
        <Skeleton className="size-7 rounded-full" />
      </div>
    );
  }

  if (summary.isError || catalog.isError) {
    return (
      <div
        className={cn(
          "text-muted-foreground flex items-center gap-2 text-sm",
          className,
        )}
        ref={ref}
        role="alert"
      >
        <span>{t("load_error.title")}</span>
        <Button
          isLoading={summary.isFetching || catalog.isFetching}
          onClick={() => {
            void summary.refetch();
            void catalog.refetch();
          }}
          size="xs"
          variant="ghost"
        >
          <RotateCwIcon aria-hidden="true" />
          {t("retry")}
        </Button>
      </div>
    );
  }

  const byCode = new Map(
    catalog.data.items.map((item, position) => [item.code, { item, position }]),
  );
  const pills = summary.data.counts
    .flatMap(({ code, count }) => {
      const entry = byCode.get(code);

      return entry ? [{ count, ...entry }] : [];
    })
    .toSorted((a, b) => a.position - b.position);
  const showPicker =
    viewerId !== null && summary.data.canReact && catalog.data.maxPerItem !== 0;
  if (pills.length === 0 && !showPicker) return null;

  return (
    <div
      aria-busy={toggle.isPending || summary.isFetching}
      className={cn("flex flex-wrap items-center gap-1", className)}
      ref={ref}
    >
      <ReactionBarItems
        catalog={catalog.data}
        onWhoChange={setWho}
        pills={pills}
        showPicker={showPicker}
        signedIn={viewerId !== null}
        summary={summary.data}
        target={target}
        toggle={toggle}
        who={who}
      />
    </div>
  );
};

/**
 * Reactions of one item: a pill per reaction with its count (pressed when the
 * viewer used it), a picker with the reactions the viewer's roles allow, and
 * "who reacted". Counts update live over the WebSocket while the bar is on
 * screen. Guests see the counts only, without the picker or "who reacted";
 * how many reactions per item and per day is up to the viewer's roles.
 * Browser-rendered; data is read per viewer.
 *
 * @example
 * ```tsx
 * import { contentTarget } from "@vitnode/core/content";
 * import { ReactionBar } from "@vitnode/core/tanstack/reactions";
 *
 * <ReactionBar target={contentTarget(manifest.id, articleContentType, item.id)} />;
 * ```
 */
export const ReactionBar = (props: ReactionBarProps) => (
  <React.Suspense fallback={null}>
    <RouteMessages namespaces={REACTIONS_NAMESPACES}>
      <ReactionBarInner {...props} />
    </RouteMessages>
  </React.Suspense>
);
