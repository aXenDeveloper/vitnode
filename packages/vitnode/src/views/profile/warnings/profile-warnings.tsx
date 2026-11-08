import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import {
  ChevronRightIcon,
  MessageSquareWarningIcon,
  RotateCcwIcon,
  RotateCwIcon,
  ShieldOffIcon,
  TriangleAlertIcon,
} from "lucide-react";
import React from "react";
import { useFormatter, useLocale, useNow, useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { FEEDBACK_TONE_TEXT } from "@/components/ui/feedback-tone";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { SlidingNumber } from "@/components/ui/sliding-number";
import { TooltipWithContent } from "@/components/ui/tooltip";
import { WarnDialog } from "@/tanstack/moderation/warn-button";
import { ModcpRequestError } from "@/views/moderation/modcp/modcp-query";
import { PersonName } from "@/views/moderation/modcp/report-tone";
import {
  accountStatusQueryOptions,
  memberStandingQueryOptions,
} from "@/views/moderation/warnings/warnings-api";

import type {
  ProfileStanding,
  StandingConfirm,
  StandingEntry,
  StandingTarget,
} from "./standing";

import {
  activeSuspensionOf,
  standingEntries,
  standingFromAccountStatus,
  standingFromModcp,
} from "./standing";
import {
  reasonTextOf,
  SuspensionLength,
  SuspensionNode,
  SuspensionTitle,
  WarningNode,
} from "./standing-parts";

const StandingSheetContent = React.lazy(
  async () => await import("./standing-sheet-content"),
);

const StandingConfirmContent = React.lazy(
  async () => await import("./standing-confirm-content"),
);

const VISIBLE_ENTRIES = 4;

const RowAction = ({
  entry,
  onConfirm,
  standing,
}: {
  entry: StandingEntry;
  onConfirm: (confirm: StandingConfirm) => void;
  standing: ProfileStanding;
}) => {
  const t = useTranslations("core.moderation.profile_card");
  const tWarn = useTranslations("core.moderation.warn");
  const locale = useLocale();

  if (
    entry.kind === "warning" &&
    standing.can.revoke &&
    entry.warning.status !== "revoked"
  ) {
    const { warning } = entry;

    return (
      <TooltipWithContent text={t("revoke")}>
        <Button
          aria-label={t("revoke_label", {
            reason: reasonTextOf(warning, locale, tWarn("custom_reason")),
          })}
          className="text-muted-foreground"
          onClick={() => {
            onConfirm({ kind: "revoke", warning });
          }}
          size="icon"
          variant="ghost"
        >
          <RotateCcwIcon aria-hidden="true" />
        </Button>
      </TooltipWithContent>
    );
  }

  if (
    entry.kind === "suspension" &&
    standing.can.lift &&
    entry.suspension.active
  ) {
    const { suspension } = entry;

    return (
      <TooltipWithContent text={t("lift")}>
        <Button
          aria-label={t("lift")}
          className="text-muted-foreground"
          onClick={() => {
            onConfirm({ kind: "lift", suspension });
          }}
          size="icon"
          variant="ghost"
        >
          <ShieldOffIcon aria-hidden="true" />
        </Button>
      </TooltipWithContent>
    );
  }

  return null;
};

const EntryRow = ({
  entry,
  last,
  onConfirm,
  onOpen,
  standing,
}: {
  entry: StandingEntry;
  last: boolean;
  onConfirm: (confirm: StandingConfirm) => void;
  onOpen: (target: StandingTarget) => void;
  standing: ProfileStanding;
}) => {
  const t = useTranslations("core.moderation.profile_card");
  const tWarn = useTranslations("core.moderation.warn");
  const tStatus = useTranslations("core.moderation.warn.statuses");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const locale = useLocale();
  const revoked =
    entry.kind === "warning" && entry.warning.status === "revoked";

  return (
    <li className="flex gap-4">
      <span aria-hidden="true" className="flex flex-col items-center gap-1">
        {entry.kind === "warning" ? (
          <WarningNode warning={entry.warning} />
        ) : (
          <SuspensionNode active={entry.suspension.active} />
        )}
        {last ? null : <span className="bg-border min-h-3 w-px flex-1" />}
      </span>
      <div
        className={cn(
          "flex min-w-0 flex-1 items-start gap-2",
          last ? null : "pb-5",
        )}
      >
        <button
          aria-haspopup="dialog"
          className="hover:bg-muted/60 active:bg-muted focus-visible:ring-ring/50 -mx-2 -my-1 flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5 rounded-lg px-2 py-1 text-start transition-colors duration-150 outline-none focus-visible:ring-3"
          onClick={() => {
            onOpen(
              entry.kind === "warning"
                ? { id: entry.warning.id, kind: "warning" }
                : { id: entry.suspension.id, kind: "suspension" },
            );
          }}
          type="button"
        >
          <span
            className={cn(
              "line-clamp-2 text-base font-semibold text-pretty",
              revoked
                ? "text-muted-foreground line-through"
                : "text-foreground",
            )}
          >
            {entry.kind === "warning" ? (
              reasonTextOf(entry.warning, locale, tWarn("custom_reason"))
            ) : (
              <SuspensionTitle suspension={entry.suspension} />
            )}
          </span>
          {entry.kind === "warning" ? (
            <span className="sr-only">
              {`${tWarn("points", { count: entry.warning.points })}, ${tStatus(entry.warning.status)}`}
            </span>
          ) : null}
          <span className="text-muted-foreground flex min-w-0 gap-1 text-sm">
            <span className="flex min-w-0">
              {entry.kind === "warning" ? (
                entry.warning.issuedBy ? (
                  <PersonName person={entry.warning.issuedBy} />
                ) : (
                  tWarn("points", { count: entry.warning.points })
                )
              ) : (
                <SuspensionLength suspension={entry.suspension} />
              )}
            </span>
            {entry.kind === "suspension" &&
            entry.suspension.endsAt === null ? null : (
              <span aria-hidden="true">·</span>
            )}
            <span className="shrink-0">
              {entry.kind === "suspension" && entry.suspension.active
                ? entry.suspension.endsAt
                  ? t("ends", {
                      relative: format.relativeTime(
                        entry.suspension.endsAt,
                        now,
                      ),
                    })
                  : null
                : format.relativeTime(entry.at, now)}
            </span>
          </span>
        </button>
        <RowAction entry={entry} onConfirm={onConfirm} standing={standing} />
      </div>
    </li>
  );
};

const StatusLine = ({ standing }: { standing: ProfileStanding }) => {
  const t = useTranslations("core.moderation.profile_card");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const suspension = activeSuspensionOf(standing);

  if (!suspension) {
    return (
      <p className="text-muted-foreground text-sm leading-relaxed">
        {t("no_restrictions")}
      </p>
    );
  }

  return (
    <p
      className={cn(
        "text-sm leading-relaxed font-medium text-pretty",
        FEEDBACK_TONE_TEXT.destructive,
      )}
    >
      {suspension.endsAt
        ? t("suspended_until", {
            relative: format.relativeTime(suspension.endsAt, now),
          })
        : t("suspended_indefinitely")}
    </p>
  );
};

const StandingCard = ({
  standing,
  userId,
}: {
  standing: ProfileStanding;
  userId: number;
}) => {
  const t = useTranslations("core.moderation.profile_card");
  const titleId = React.useId();
  const [target, setTarget] = React.useState<StandingTarget>(null);
  const [shownTarget, setShownTarget] = React.useState(target);
  const [confirm, setConfirm] = React.useState<StandingConfirm>(null);
  const [shownConfirm, setShownConfirm] = React.useState(confirm);
  const [warning, setWarning] = React.useState(false);
  if (target && target !== shownTarget) setShownTarget(target);
  if (confirm && confirm !== shownConfirm) setShownConfirm(confirm);

  const suspension = activeSuspensionOf(standing);
  const entries = standingEntries(standing);
  const visible = entries.slice(0, VISIBLE_ENTRIES);
  const showLift = standing.can.lift && suspension;
  const showHistory = visible.length > 0 || standing.hiddenWarnings > 0;

  return (
    <Card aria-labelledby={titleId} className="h-fit" role="region">
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h2
            className="text-foreground flex items-center gap-3 text-2xl font-semibold text-balance tabular-nums"
            id={titleId}
          >
            {t.rich("points_animated", {
              count: standing.activePoints,
              n: () => (
                <span
                  className={cn(
                    "flex h-12 min-w-12 shrink-0 items-center justify-center rounded-full px-3",
                    suspension
                      ? ["bg-destructive/15", FEEDBACK_TONE_TEXT.destructive]
                      : standing.activePoints > 0
                        ? ["bg-warn/15", FEEDBACK_TONE_TEXT.warning]
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  <SlidingNumber value={standing.activePoints} />
                </span>
              ),
            })}
          </h2>
          <StatusLine standing={standing} />
        </div>
        {showLift || standing.can.warn ? (
          <div className="flex flex-wrap gap-2">
            {showLift ? (
              <Button
                className="flex-1"
                onClick={() => {
                  setConfirm({ kind: "lift", suspension });
                }}
                variant="outline"
              >
                <ShieldOffIcon aria-hidden="true" />
                {t("lift")}
              </Button>
            ) : null}
            {standing.can.warn ? (
              <Button
                className="flex-1"
                onClick={() => {
                  setWarning(true);
                }}
                variant="secondary"
              >
                <TriangleAlertIcon aria-hidden="true" />
                {t("warn")}
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>

      {showHistory ? (
        <CardContent className="border-t pt-6">
          {visible.length > 0 ? (
            <ol aria-label={t("history")} className="flex flex-col">
              {visible.map((entry, index) => (
                <EntryRow
                  entry={entry}
                  key={
                    entry.kind === "warning"
                      ? `w-${entry.warning.id}`
                      : `s-${entry.suspension.id}`
                  }
                  last={index === visible.length - 1}
                  onConfirm={setConfirm}
                  onOpen={setTarget}
                  standing={standing}
                />
              ))}
            </ol>
          ) : null}
          {standing.hiddenWarnings > 0 ? (
            <p className="text-muted-foreground pt-4 text-xs leading-relaxed text-pretty">
              {t("hidden", { count: standing.hiddenWarnings })}
            </p>
          ) : null}
        </CardContent>
      ) : null}

      {entries.length > 0 ? (
        <CardFooter className="justify-end py-3">
          <Link
            className="text-foreground focus-visible:ring-ring/50 inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-3"
            to={standing.seeAllHref}
          >
            {t("see_all")}
            <SlidingNumber
              className="text-muted-foreground"
              value={entries.length}
            />
            <ChevronRightIcon
              aria-hidden="true"
              className="size-4 rtl:-scale-x-100"
            />
          </Link>
        </CardFooter>
      ) : null}

      <Sheet
        onOpenChange={open => {
          if (!open) setTarget(null);
        }}
        open={target !== null}
      >
        <SheetContent className="gap-0 sm:max-w-md" side="left">
          {shownTarget ? (
            <React.Suspense
              fallback={
                <div aria-busy="true" className="flex flex-col gap-4 p-6">
                  <Skeleton className="size-12 rounded-full" />
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              }
            >
              <StandingSheetContent
                onConfirm={setConfirm}
                onSelect={setTarget}
                standing={standing}
                target={shownTarget}
              />
            </React.Suspense>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog
        onOpenChange={open => {
          if (!open) setConfirm(null);
        }}
        open={confirm !== null}
      >
        <DialogContent className="sm:max-w-md">
          {shownConfirm ? (
            <React.Suspense
              fallback={
                <div aria-busy="true" className="flex flex-col gap-4">
                  <Skeleton className="h-6 w-1/2" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              }
            >
              <StandingConfirmContent
                confirm={shownConfirm}
                key={
                  shownConfirm.kind === "revoke"
                    ? `w-${shownConfirm.warning.id}`
                    : `s-${shownConfirm.suspension.id}`
                }
                onClose={() => {
                  setConfirm(null);
                }}
              />
            </React.Suspense>
          ) : null}
        </DialogContent>
      </Dialog>

      {standing.can.warn ? (
        <WarnDialog onOpenChange={setWarning} open={warning} userId={userId} />
      ) : null}
    </Card>
  );
};

export const ProfileWarningsSkeleton = ({ label }: { label?: string }) => (
  <Card aria-busy="true" className="h-fit">
    {label ? (
      <span className="sr-only" role="status">
        {label}
      </span>
    ) : null}
    <CardContent className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-40" />
      </div>
      <Skeleton className="h-9 w-full" />
    </CardContent>
    <CardContent className="flex flex-col gap-5 border-t pt-6">
      {[0, 1, 2].map(row => (
        <div className="flex gap-4" key={row}>
          <Skeleton className="size-10 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      ))}
    </CardContent>
  </Card>
);

const forbidden = (error: unknown) =>
  error instanceof ModcpRequestError &&
  (error.status === 401 || error.status === 403);

export const ProfileWarnings = ({
  isOwner,
  userId,
}: {
  isOwner: boolean;
  userId: number;
}) => {
  const t = useTranslations("core.moderation.profile_card");
  const own = useQuery({ ...accountStatusQueryOptions(), enabled: isOwner });
  const staff = useQuery({
    ...memberStandingQueryOptions(userId),
    enabled: !isOwner,
  });
  const query = isOwner ? own : staff;

  if (query.isPending) return <ProfileWarningsSkeleton label={t("loading")} />;

  if (query.isError) {
    if (forbidden(query.error)) return null;

    return (
      <Empty className="border" role="alert">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MessageSquareWarningIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{t("load_error.title")}</EmptyTitle>
          <EmptyDescription>{t("load_error.desc")}</EmptyDescription>
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
    );
  }

  const standing = isOwner
    ? own.data
      ? standingFromAccountStatus(own.data)
      : null
    : staff.data
      ? standingFromModcp(staff.data)
      : null;

  if (!standing) return null;

  return <StandingCard standing={standing} userId={userId} />;
};
