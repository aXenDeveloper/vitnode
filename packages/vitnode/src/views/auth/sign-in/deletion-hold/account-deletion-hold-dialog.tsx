import { CalendarClockIcon, RotateCcwIcon } from "lucide-react";
import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import React from "react";
import { toast } from "sonner";
import { useFormatter, useNow, useTranslations } from "use-intl";

import { MotionFeatures } from "@/components/motion-features";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  BADGE_ENTER,
  type MotionEnter,
  REVEAL_EXIT_TRANSITION,
  REVEAL_HIDDEN,
  REVEAL_SHOWN,
  REVEAL_TRANSITION,
  staggeredEnter,
} from "@/lib/motion";

import type { CancelDeletionSignInSubmit, HeldSignIn } from "./schema";

import { DeletionCountdown } from "../../deletion-countdown";

const DAY_MS = 86_400_000;

const ExpiredNotice = ({ isExpired }: { isExpired: boolean }) => {
  const t = useTranslations("core.auth.sign_in.deletion_hold.expired");
  const shouldReduceMotion = useReducedMotion();

  return (
    <AnimatePresence initial={false}>
      {isExpired ? (
        <m.div
          animate={REVEAL_SHOWN}
          className="overflow-y-clip text-left"
          exit={
            shouldReduceMotion
              ? undefined
              : { ...REVEAL_HIDDEN, transition: REVEAL_EXIT_TRANSITION }
          }
          initial={shouldReduceMotion ? false : REVEAL_HIDDEN}
          key="expired"
          transition={REVEAL_TRANSITION}
        >
          <Alert role="alert" variant="destructive">
            <AlertTitle>{t("title")}</AlertTitle>
            <AlertDescription>{t("desc")}</AlertDescription>
          </Alert>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
};

const Countdown = ({ scheduledAt }: { scheduledAt: Date }) => {
  const t = useTranslations("core.auth.sign_in.deletion_hold");
  const format = useFormatter();
  const now = useNow();
  const daysLeft = Math.max(
    0,
    Math.round((scheduledAt.getTime() - now.getTime()) / DAY_MS),
  );

  return (
    <DeletionCountdown
      caption={t.rich("deleted_on", {
        date: () => (
          <time dateTime={scheduledAt.toISOString()}>
            {format.dateTime(scheduledAt, { dateStyle: "long" })}
          </time>
        ),
      })}
      days={daysLeft}
      enter={staggeredEnter(2)}
      label={t("days_left", { count: daysLeft })}
    />
  );
};

export const AccountDeletionHoldDialog = ({
  hold,
  onConfirm,
  onKeep,
}: {
  hold: HeldSignIn | null;
  onConfirm: CancelDeletionSignInSubmit;
  onKeep: () => void;
}) => {
  const t = useTranslations("core.auth.sign_in.deletion_hold");
  const tErrors = useTranslations("core.global.errors");
  const shouldReduceMotion = useReducedMotion();
  const [shown, setShown] = React.useState(hold);
  const [isPending, setIsPending] = React.useState(false);
  const [isExpired, setIsExpired] = React.useState(false);
  const confirmRef = React.useRef<HTMLButtonElement>(null);

  if (hold && hold.token !== shown?.token) {
    setShown(hold);
    setIsExpired(false);
  }

  const enter = (motion: MotionEnter) => (shouldReduceMotion ? {} : motion);

  const onClick = async () => {
    if (!shown) return;
    setIsPending(true);

    try {
      const failure = await onConfirm(shown);

      if (!failure) {
        toast.success(t("success.title"), {
          description: t("success.desc"),
        });

        return;
      }

      if (failure === "invalid_hold") {
        setIsExpired(true);

        return;
      }

      toast.error(tErrors("title"), {
        description: tErrors("internal_server_error"),
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <MotionFeatures>
      <AlertDialog
        onOpenChange={open => {
          if (!open && !isPending) onKeep();
        }}
        open={!!hold}
      >
        <AlertDialogContent initialFocus={confirmRef} size="sm">
          {shown ? (
            <>
              <AlertDialogHeader>
                <AlertDialogMedia className="bg-destructive/10 text-destructive rounded-full">
                  <m.span
                    {...enter(BADGE_ENTER)}
                    aria-hidden="true"
                    className="flex"
                  >
                    <CalendarClockIcon className="size-6" />
                  </m.span>
                </AlertDialogMedia>
                <AlertDialogTitle
                  render={<m.h2 {...enter(staggeredEnter(0))} />}
                >
                  {t("title")}
                </AlertDialogTitle>
                <AlertDialogDescription
                  className="leading-relaxed"
                  render={<m.p {...enter(staggeredEnter(1))} />}
                >
                  {t("desc")}
                </AlertDialogDescription>
              </AlertDialogHeader>

              <Countdown scheduledAt={shown.scheduledAt} />

              <ExpiredNotice isExpired={isExpired} />

              <AlertDialogFooter className="group-data-[size=sm]/alert-dialog-content:flex sm:flex-col-reverse">
                <AlertDialogCancel
                  disabled={isPending}
                  size="lg"
                  variant={isExpired ? "default" : "outline"}
                >
                  {isExpired ? t("back") : t("keep")}
                </AlertDialogCancel>
                {isExpired ? null : (
                  <Button
                    isLoading={isPending}
                    onClick={onClick}
                    ref={confirmRef}
                    size="lg"
                  >
                    <RotateCcwIcon aria-hidden="true" />
                    {t("confirm")}
                  </Button>
                )}
              </AlertDialogFooter>
            </>
          ) : null}
        </AlertDialogContent>
      </AlertDialog>
    </MotionFeatures>
  );
};
