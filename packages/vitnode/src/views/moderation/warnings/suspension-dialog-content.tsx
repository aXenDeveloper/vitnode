import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import { LockIcon, LogOutIcon } from "lucide-react";
import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import React from "react";
import { toast } from "sonner";
import { useFormatter, useLocale, useNow, useTranslations } from "use-intl";

import { MotionFeatures } from "@/components/motion-features";
import { Button } from "@/components/ui/button";
import { DialogTitle } from "@/components/ui/dialog";
import { FEEDBACK_TONE_TEXT } from "@/components/ui/feedback-tone";
import { Skeleton } from "@/components/ui/skeleton";
import { SlidingNumber } from "@/components/ui/sliding-number";
import { useSignOutAction } from "@/tanstack/auth/actions";
import { invalidateSession } from "@/tanstack/auth/session-query";

import { resolveReasonText } from "../report-reasons-query";
import { WarningMessageContent } from "./warning-message";
import { accountStatusQueryOptions } from "./warnings-api";

const RING = 44;
const STROKE = 4;
const RADIUS = RING - STROKE;
const SECOND = 1000;

const servedShare = (startsAt: Date | null, endsAt: Date | null, now: Date) => {
  if (!startsAt || !endsAt) return 1;
  const total = endsAt.getTime() - startsAt.getTime();
  if (total <= 0) return 1;

  return Math.min(1, Math.max(0, (now.getTime() - startsAt.getTime()) / total));
};

const remainingParts = (endsAt: Date, now: Date) => {
  const seconds = Math.max(
    0,
    Math.floor((endsAt.getTime() - now.getTime()) / SECOND),
  );

  return {
    days: Math.floor(seconds / 86_400),
    hours: Math.floor((seconds % 86_400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
    total: seconds,
  };
};

const ProgressIcon = ({ served }: { served: number }) => {
  const reduce = useReducedMotion();

  return (
    <MotionFeatures>
      <span
        aria-hidden="true"
        className="relative flex size-22 shrink-0 items-center justify-center"
      >
        <svg
          className="absolute inset-0 size-22 -rotate-90"
          viewBox={`0 0 ${RING * 2} ${RING * 2}`}
        >
          <circle
            className="stroke-muted"
            cx={RING}
            cy={RING}
            fill="none"
            r={RADIUS}
            strokeWidth={STROKE}
          />
          <m.circle
            animate={{ pathLength: Math.max(0.02, served) }}
            className="stroke-destructive"
            cx={RING}
            cy={RING}
            fill="none"
            initial={reduce ? false : { pathLength: 0 }}
            r={RADIUS}
            strokeLinecap="round"
            strokeWidth={STROKE}
            transition={
              reduce
                ? { duration: 0 }
                : { delay: 0.15, duration: 0.9, ease: [0.32, 0.72, 0, 1] }
            }
          />
        </svg>
        <m.span
          animate={{ opacity: 1, scale: 1 }}
          className="bg-destructive/10 flex size-14 items-center justify-center rounded-full"
          initial={reduce ? false : { opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", duration: 0.45, bounce: 0.15 }}
        >
          <LockIcon className={cn("size-6", FEEDBACK_TONE_TEXT.destructive)} />
        </m.span>
      </span>
    </MotionFeatures>
  );
};

const Unit = ({ label, value }: { label: string; value: number }) => (
  <div className="flex min-w-14 flex-col items-center gap-1">
    <SlidingNumber
      className="text-foreground text-4xl font-semibold tracking-tight"
      value={value}
    />
    <span className="text-muted-foreground text-xs">{label}</span>
  </div>
);

const Countdown = ({ endsAt }: { endsAt: Date }) => {
  const t = useTranslations("core.moderation.account_status.dialog");
  const now = useNow({ updateInterval: SECOND });
  const queryClient = useQueryClient();
  const left = remainingParts(endsAt, now);
  const ended = left.total === 0;

  React.useEffect(() => {
    if (ended) void invalidateSession(queryClient);
  }, [ended, queryClient]);

  return (
    <section aria-label={t("time_left")} className="flex justify-center gap-4">
      {left.days > 0 ? (
        <Unit label={t("days", { count: left.days })} value={left.days} />
      ) : null}
      <Unit label={t("hours", { count: left.hours })} value={left.hours} />
      <Unit label={t("minutes")} value={left.minutes} />
      <Unit label={t("seconds")} value={left.seconds} />
    </section>
  );
};

const DevSignOut = () => {
  const t = useTranslations("core.moderation.account_status.dialog");
  const tErrors = useTranslations("core.global.errors");
  const signOut = useSignOutAction();
  const [pending, setPending] = React.useState(false);

  return (
    <Button
      className="w-full"
      isLoading={pending}
      onClick={async () => {
        setPending(true);
        try {
          const result = await signOut();
          if (!result.ok) {
            toast.error(tErrors("title"), {
              description: tErrors("internal_server_error"),
            });
          }
        } finally {
          setPending(false);
        }
      }}
      variant="outline"
    >
      <LogOutIcon aria-hidden="true" />
      {t("sign_out")}
    </Button>
  );
};

const Fact = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex flex-col gap-0.5">
    <dt className="text-muted-foreground text-xs">{label}</dt>
    <dd className="text-foreground text-sm tabular-nums">{value}</dd>
  </div>
);

const DetailsSkeleton = () => (
  <div aria-hidden="true" className="flex w-full flex-col gap-3">
    <Skeleton className="h-4 w-1/3" />
    <Skeleton className="h-16 w-full" />
    <Skeleton className="h-20 w-full" />
  </div>
);

export const SuspensionDialogContent = ({
  endsAt: sessionEndsAt,
}: {
  endsAt: Date | null;
}) => {
  const t = useTranslations("core.moderation.account_status.dialog");
  const format = useFormatter();
  const locale = useLocale();
  const now = useNow({ updateInterval: 60 * SECOND });
  const status = useQuery(accountStatusQueryOptions());
  const sanction = status.data?.sanctions.find(item => item.active) ?? null;
  const warning =
    status.data?.warnings.find(item => item.id === sanction?.warningId) ?? null;
  const startsAt = sanction ? new Date(sanction.startsAt) : null;
  const endsAt = sanction?.endsAt
    ? new Date(sanction.endsAt)
    : sanction
      ? null
      : sessionEndsAt;
  const reason = warning?.reason
    ? resolveReasonText(warning.reason, locale)
    : null;
  const when = (date: Date) =>
    format.dateTime(date, { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="flex flex-col items-center gap-6 p-6 text-center sm:p-8">
      <ProgressIcon served={servedShare(startsAt, endsAt, now)} />

      <DialogTitle className="text-xl text-balance">{t("title")}</DialogTitle>

      {endsAt ? (
        <Countdown endsAt={endsAt} />
      ) : (
        <p className="text-foreground font-medium text-pretty">{t("no_end")}</p>
      )}

      {status.isPending ? (
        <div aria-busy="true" className="w-full" role="status">
          <span className="sr-only">{t("loading")}</span>
          <DetailsSkeleton />
        </div>
      ) : (
        <div className="flex w-full flex-col gap-5 text-start">
          {warning ? (
            <section
              aria-labelledby="suspension-why"
              className="flex flex-col gap-2"
            >
              <h3
                className="text-muted-foreground text-xs font-medium"
                id="suspension-why"
              >
                {t("why")}
              </h3>
              <div className="border-destructive/30 flex flex-col gap-1 border-s-2 ps-3">
                <p className="text-foreground text-sm font-medium text-pretty">
                  {reason ?? t("because_unknown")}
                  {status.data ? (
                    <span className="text-muted-foreground font-normal">
                      {" · "}
                      {t("points", { count: status.data.activePoints })}
                    </span>
                  ) : null}
                </p>
                <WarningMessageContent
                  className="text-muted-foreground"
                  message={warning.message}
                />
              </div>
            </section>
          ) : null}

          <dl className="bg-muted/50 grid grid-cols-2 gap-4 rounded-lg p-4">
            <Fact
              label={t("started")}
              value={startsAt ? when(startsAt) : "-"}
            />
            <Fact
              label={t("ends")}
              value={endsAt ? when(endsAt) : t("never")}
            />
          </dl>
        </div>
      )}

      {import.meta.env.DEV ? (
        <div className="flex w-full flex-col items-center">
          <DevSignOut />
        </div>
      ) : null}
    </div>
  );
};

export default SuspensionDialogContent;
