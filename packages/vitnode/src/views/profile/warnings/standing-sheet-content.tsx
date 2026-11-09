import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import {
  ChevronRightIcon,
  ExternalLinkIcon,
  FlagIcon,
  LockIcon,
  RotateCcwIcon,
  ShieldOffIcon,
  Undo2Icon,
} from "lucide-react";
import React from "react";
import { useFormatter, useLocale, useNow, useTranslations } from "use-intl";

import { DateFormat } from "@/components/date-format";
import { Button } from "@/components/ui/button";
import { FEEDBACK_TONE_TEXT } from "@/components/ui/feedback-tone";
import { Progress } from "@/components/ui/progress";
import {
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Person, PersonName } from "@/views/moderation/modcp/report-tone";
import { SuspensionStatusBadge } from "@/views/moderation/warnings/suspension-status-badge";
import { WarningStatusBadge } from "@/views/moderation/warnings/warning-format";
import {
  WarningMessageContent,
  WarningNoteContent,
} from "@/views/moderation/warnings/warning-message";

import type {
  ProfileStanding,
  StandingConfirm,
  StandingSuspension,
  StandingTarget,
  StandingWarning,
} from "./standing";

import { elapsedShare } from "./standing";
import {
  reasonTextOf,
  SuspensionLength,
  SuspensionNode,
  SuspensionTitle,
  WarningNode,
} from "./standing-parts";

const Section = ({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) => {
  const id = React.useId();

  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h3 className="text-muted-foreground text-xs font-medium" id={id}>
        {title}
      </h3>
      {children}
    </section>
  );
};

const Fact = ({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) => (
  <div className="flex min-w-0 flex-col gap-0.5">
    <dt className="text-muted-foreground text-xs">{label}</dt>
    <dd className="text-foreground text-sm leading-relaxed wrap-break-word">
      {children}
    </dd>
  </div>
);

const LinkedCard = ({
  children,
  icon,
  meta,
  onClick,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  meta: React.ReactNode;
  onClick: () => void;
}) => (
  <button
    className="bg-muted/50 hover:bg-muted focus-visible:ring-ring/50 flex w-full cursor-pointer items-center gap-3 rounded-lg p-3 text-start transition-colors duration-150 outline-none focus-visible:ring-3"
    onClick={onClick}
    type="button"
  >
    {icon}
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="text-foreground line-clamp-2 text-sm font-medium text-pretty">
        {children}
      </span>
      <span className="text-muted-foreground text-xs">{meta}</span>
    </span>
    <ChevronRightIcon
      aria-hidden="true"
      className="text-muted-foreground size-4 shrink-0 rtl:-scale-x-100"
    />
  </button>
);

const WarningBody = ({
  onSelect,
  standing,
  warning,
}: {
  onSelect: (target: StandingTarget) => void;
  standing: ProfileStanding;
  warning: StandingWarning;
}) => {
  const t = useTranslations("core.moderation.profile_card.sheet");
  const tList = useTranslations("core.moderation.warn.list");
  const tWarn = useTranslations("core.moderation.warn");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const caused = standing.suspensions.find(
    suspension => suspension.warningId === warning.id,
  );
  const { expiresAt, issuedBy, revokedAt } = warning;

  return (
    <>
      <Section title={standing.own ? t("message_own") : t("message")}>
        <blockquote className="border-warn/40 border-s-2 ps-3">
          <WarningMessageContent
            className="text-foreground"
            message={warning.message}
          />
        </blockquote>
      </Section>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Fact label={t("points")}>
          <span className="tabular-nums">{warning.points}</span>
          {warning.status === "active" ? null : (
            <span className="text-muted-foreground">
              {" · "}
              {t("not_counting")}
            </span>
          )}
        </Fact>
        {issuedBy === undefined ? null : (
          <Fact label={tList("issued_by")}>
            {issuedBy ? (
              <Person link person={issuedBy} />
            ) : (
              tWarn("deleted_user")
            )}
          </Fact>
        )}
        <Fact label={t("issued")}>
          <DateFormat date={warning.issuedAt} showFullDate />
        </Fact>
        <Fact
          label={warning.status === "expired" ? t("expired") : t("expires")}
        >
          {expiresAt ? (
            <DateFormat date={expiresAt} showFullDate />
          ) : (
            t("never")
          )}
        </Fact>
      </dl>

      {warning.status === "active" && expiresAt ? (
        <Progress
          aria-label={t("stops_counting", {
            relative: format.relativeTime(expiresAt, now),
          })}
          indicatorClassName="bg-warn"
          value={(1 - elapsedShare(warning.issuedAt, expiresAt)) * 100}
        >
          <span className="text-muted-foreground order-last text-xs">
            {t("stops_counting", {
              relative: format.relativeTime(expiresAt, now),
            })}
          </span>
        </Progress>
      ) : null}

      {warning.content ? (
        <Section title={tList("content")}>
          {warning.content.url ? (
            <a
              className="text-primary inline-flex items-start gap-1.5 text-sm leading-relaxed underline-offset-4 hover:underline"
              href={warning.content.url}
            >
              <span className="text-pretty">
                {warning.content.title ?? tList("untitled")}
              </span>
              <ExternalLinkIcon
                aria-hidden="true"
                className="mt-1 size-3.5 shrink-0"
              />
            </a>
          ) : (
            <p className="text-foreground text-sm leading-relaxed text-pretty">
              {warning.content.title ?? tList("untitled")}
            </p>
          )}
        </Section>
      ) : null}

      {warning.reportId ? (
        <Section title={tList("report")}>
          <Link
            className="text-primary inline-flex items-center gap-1.5 text-sm underline-offset-4 hover:underline"
            to={`/modcp/reports/${warning.reportId}`}
          >
            <FlagIcon aria-hidden="true" className="size-3.5" />
            {tList("report_link", { id: warning.reportId })}
          </Link>
        </Section>
      ) : null}

      {warning.staffNote || warning.overrideNote ? (
        <Section title={t("staff_note")}>
          <div className="bg-muted/60 flex flex-col gap-2 rounded-lg p-3">
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
              <LockIcon aria-hidden="true" className="size-3.5" />
              {t("staff_only")}
            </p>
            {warning.staffNote ? (
              <WarningNoteContent
                className="text-foreground"
                note={warning.staffNote}
              />
            ) : null}
            {warning.overrideNote ? (
              <div className="flex flex-col gap-0.5">
                <p className="text-muted-foreground text-xs">
                  {tList("override_note")}
                </p>
                <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">
                  {warning.overrideNote}
                </p>
              </div>
            ) : null}
          </div>
        </Section>
      ) : null}

      {caused ? (
        <Section title={t("led_to")}>
          <LinkedCard
            icon={<SuspensionNode active={caused.active} size="sm" />}
            meta={<SuspensionLength suspension={caused} />}
            onClick={() => {
              onSelect({ id: caused.id, kind: "suspension" });
            }}
          >
            <SuspensionTitle suspension={caused} />
          </LinkedCard>
        </Section>
      ) : null}

      {revokedAt ? (
        <Section title={t("revoked")}>
          <div className="text-foreground flex items-start gap-2 text-sm leading-relaxed text-pretty">
            <Undo2Icon
              aria-hidden="true"
              className="text-muted-foreground mt-0.5 size-4 shrink-0"
            />
            <p>
              {tList.rich("revoked", {
                by: () =>
                  warning.revokedBy ? (
                    <PersonName link person={warning.revokedBy} />
                  ) : (
                    tWarn("deleted_user")
                  ),
                date: () => <DateFormat date={revokedAt} />,
              })}
              {warning.revokeReason ? ` ${warning.revokeReason}` : null}
            </p>
          </div>
        </Section>
      ) : null}
    </>
  );
};

const SuspensionBody = ({
  onSelect,
  standing,
  suspension,
}: {
  onSelect: (target: StandingTarget) => void;
  standing: ProfileStanding;
  suspension: StandingSuspension;
}) => {
  const t = useTranslations("core.moderation.profile_card.sheet");
  const tCard = useTranslations("core.moderation.profile_card");
  const tSanctions = useTranslations("core.moderation.warn.sanctions");
  const tList = useTranslations("core.moderation.warn.list");
  const tStatus = useTranslations("core.moderation.account_status");
  const tWarn = useTranslations("core.moderation.warn");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const locale = useLocale();
  const cause = standing.warnings.find(
    warning => warning.id === suspension.warningId,
  );
  const { endsAt, liftedAt } = suspension;
  const served = endsAt ? elapsedShare(suspension.startsAt, endsAt) : null;

  return (
    <>
      {suspension.active ? (
        <div className="bg-destructive/10 flex flex-col gap-3 rounded-lg p-3">
          <p
            className={cn(
              "text-sm font-semibold",
              FEEDBACK_TONE_TEXT.destructive,
            )}
          >
            {endsAt
              ? tCard("suspended_until", {
                  relative: format.relativeTime(endsAt, now),
                })
              : tCard("suspended_indefinitely")}
          </p>
          {served === null ? (
            <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
              {t("no_end_desc")}
            </p>
          ) : (
            <Progress
              aria-label={t("time_served")}
              indicatorClassName="bg-destructive"
              value={served * 100}
            >
              <span className="text-muted-foreground order-last text-xs tabular-nums">
                {t("served", { percent: Math.round(served * 100) })}
              </span>
            </Progress>
          )}
        </div>
      ) : null}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Fact label={t("started")}>
          <DateFormat date={suspension.startsAt} showFullDate />
        </Fact>
        <Fact
          label={
            suspension.active
              ? tSanctions("ends")
              : suspension.lifted
                ? tSanctions("lifted")
                : t("ended")
          }
        >
          {suspension.lifted && liftedAt ? (
            <DateFormat date={liftedAt} showFullDate />
          ) : endsAt ? (
            <DateFormat date={endsAt} showFullDate />
          ) : (
            t("never")
          )}
        </Fact>
        {suspension.source ? (
          <div className="col-span-2">
            <Fact label={t("why")}>
              {suspension.source === "threshold" &&
              suspension.thresholdPoints !== null
                ? tSanctions("from_threshold", {
                    points: suspension.thresholdPoints,
                  })
                : tSanctions("manual")}
            </Fact>
          </div>
        ) : null}
      </dl>

      {suspension.active ? (
        <Section title={t("blocks")}>
          <p className="text-foreground text-sm leading-relaxed text-pretty">
            {standing.own
              ? tStatus("suspended_restrictions")
              : t("blocks_desc")}
          </p>
        </Section>
      ) : null}

      {cause ? (
        <Section title={t("caused_by")}>
          <LinkedCard
            icon={<WarningNode size="sm" warning={cause} />}
            meta={
              <>
                {cause.issuedBy ? (
                  <>
                    <PersonName person={cause.issuedBy} />
                    {" · "}
                  </>
                ) : null}
                {format.relativeTime(cause.issuedAt, now)}
              </>
            }
            onClick={() => {
              onSelect({ id: cause.id, kind: "warning" });
            }}
          >
            {reasonTextOf(cause, locale, tWarn("custom_reason"))}
          </LinkedCard>
        </Section>
      ) : null}

      {suspension.lifted && liftedAt && suspension.liftedBy !== undefined ? (
        <Section title={tSanctions("lifted")}>
          <p className="text-foreground text-sm leading-relaxed text-pretty">
            {tList.rich("lifted", {
              by: () =>
                suspension.liftedBy ? (
                  <PersonName link person={suspension.liftedBy} />
                ) : (
                  tWarn("deleted_user")
                ),
              date: () => <DateFormat date={liftedAt} />,
            })}
            {suspension.liftReason ? ` ${suspension.liftReason}` : null}
          </p>
        </Section>
      ) : null}
    </>
  );
};

const StandingSheetContent = ({
  onConfirm,
  onSelect,
  standing,
  target,
}: {
  onConfirm: (confirm: StandingConfirm) => void;
  onSelect: (target: StandingTarget) => void;
  standing: ProfileStanding;
  target: NonNullable<StandingTarget>;
}) => {
  const t = useTranslations("core.moderation.profile_card");
  const tSheet = useTranslations("core.moderation.profile_card.sheet");
  const tWarn = useTranslations("core.moderation.warn");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const locale = useLocale();
  const warning =
    target.kind === "warning"
      ? standing.warnings.find(item => item.id === target.id)
      : undefined;
  const suspension =
    target.kind === "suspension"
      ? standing.suspensions.find(item => item.id === target.id)
      : undefined;

  if (!warning && !suspension) return null;

  return (
    <>
      <SheetHeader className="flex-row items-start gap-4 border-b p-6 pe-14">
        {warning ? (
          <WarningNode size="lg" warning={warning} />
        ) : suspension ? (
          <SuspensionNode active={suspension.active} size="lg" />
        ) : null}
        <div className="flex min-w-0 flex-col items-start gap-1.5">
          {warning ? (
            <WarningStatusBadge status={warning.status} />
          ) : suspension ? (
            <SuspensionStatusBadge suspension={suspension} />
          ) : null}
          <SheetTitle
            className={cn(
              "text-lg text-pretty",
              warning?.status === "revoked" &&
                "text-muted-foreground line-through",
            )}
          >
            {warning ? (
              reasonTextOf(warning, locale, tWarn("custom_reason"))
            ) : suspension ? (
              <SuspensionTitle suspension={suspension} />
            ) : null}
          </SheetTitle>
          <SheetDescription>
            {warning
              ? tSheet("warning_desc", {
                  relative: format.relativeTime(warning.issuedAt, now),
                })
              : suspension
                ? tSheet("suspension_desc", {
                    relative: format.relativeTime(suspension.startsAt, now),
                  })
                : null}
          </SheetDescription>
        </div>
      </SheetHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
        {warning ? (
          <WarningBody
            onSelect={onSelect}
            standing={standing}
            warning={warning}
          />
        ) : null}
        {suspension ? (
          <SuspensionBody
            onSelect={onSelect}
            standing={standing}
            suspension={suspension}
          />
        ) : null}
      </div>

      {warning && standing.can.revoke && warning.status !== "revoked" ? (
        <SheetFooter className="border-t p-6">
          <Button
            onClick={() => {
              onConfirm({ kind: "revoke", warning });
            }}
            variant="outline"
          >
            <RotateCcwIcon aria-hidden="true" />
            {t("revoke")}
          </Button>
        </SheetFooter>
      ) : null}
      {suspension && standing.can.lift && suspension.active ? (
        <SheetFooter className="border-t p-6">
          <Button
            onClick={() => {
              onConfirm({ kind: "lift", suspension });
            }}
            variant="outline"
          >
            <ShieldOffIcon aria-hidden="true" />
            {t("lift")}
          </Button>
        </SheetFooter>
      ) : null}
    </>
  );
};

export default StandingSheetContent;
