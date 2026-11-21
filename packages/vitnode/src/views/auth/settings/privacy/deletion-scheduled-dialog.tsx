import { HomeIcon, MailCheckIcon } from "lucide-react";
import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import React from "react";
import { useFormatter, useNow, useTranslations } from "use-intl";

import { MotionFeatures } from "@/components/motion-features";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { BADGE_ENTER, type MotionEnter, staggeredEnter } from "@/lib/motion";

import { DeletionCountdown } from "../../deletion-countdown";

const DAY_MS = 86_400_000;

export const DeletionScheduledDialog = ({
  onDone,
  scheduledAt,
}: {
  onDone: () => Promise<void>;
  scheduledAt: Date | null;
}) => {
  const t = useTranslations("core.auth.settings.privacy.delete");
  const format = useFormatter();
  const now = useNow();
  const shouldReduceMotion = useReducedMotion();
  const [isLeaving, setIsLeaving] = React.useState(false);
  const enter = (motion: MotionEnter) => (shouldReduceMotion ? {} : motion);
  const daysLeft = scheduledAt
    ? Math.max(0, Math.round((scheduledAt.getTime() - now.getTime()) / DAY_MS))
    : 0;

  const leave = async () => {
    if (isLeaving) return;
    setIsLeaving(true);
    await onDone();
  };

  return (
    <MotionFeatures>
      <AlertDialog
        onOpenChange={open => {
          if (!open) void leave();
        }}
        open={!!scheduledAt}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-primary/10 text-primary rounded-full">
              <m.span
                {...enter(BADGE_ENTER)}
                aria-hidden="true"
                className="flex"
              >
                <MailCheckIcon className="size-6" />
              </m.span>
            </AlertDialogMedia>
            <AlertDialogTitle render={<m.h2 {...enter(staggeredEnter(0))} />}>
              {t("success")}
            </AlertDialogTitle>
            <AlertDialogDescription
              className="leading-relaxed"
              render={<m.p {...enter(staggeredEnter(1))} />}
            >
              {t("done_desc")}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {scheduledAt && daysLeft > 0 ? (
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
              label={t("grace_days", { count: daysLeft })}
            />
          ) : null}

          {daysLeft > 0 ? (
            <m.p
              {...enter(staggeredEnter(3))}
              className="text-muted-foreground text-center text-sm leading-relaxed text-pretty"
            >
              {t("done_hint")}
            </m.p>
          ) : null}

          <AlertDialogFooter className="group-data-[size=sm]/alert-dialog-content:flex">
            <Button
              className="w-full"
              isLoading={isLeaving}
              onClick={() => {
                void leave();
              }}
              size="lg"
            >
              <HomeIcon aria-hidden="true" />
              {t("done_action")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MotionFeatures>
  );
};
