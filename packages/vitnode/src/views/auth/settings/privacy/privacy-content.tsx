import { cn } from "cn";
import { DownloadIcon, ShieldCheckIcon, Trash2Icon } from "lucide-react";
import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import React from "react";
import { toast } from "sonner";
import { useFormatter, useNow, useTranslations } from "use-intl";

import { DangerZone, DangerZoneItem } from "@/components/danger-zone";
import { MotionFeatures } from "@/components/motion-features";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/ui/page-title";
import { Skeleton } from "@/components/ui/skeleton";
import { BADGE_ENTER, type MotionEnter, staggeredEnter } from "@/lib/motion";

import type {
  AccountDeletionStatus,
  RequestAccountDeletionResult,
} from "./privacy-query";

import { DeletionCountdown } from "../../deletion-countdown";
import { SETTINGS_ROW, SettingsGroup } from "../settings-group";
import { DeletionScheduledDialog } from "./deletion-scheduled-dialog";

const DeleteAccountForm = React.lazy(async () =>
  import("./delete-account-form").then(module => ({
    default: module.DeleteAccountForm,
  })),
);

export interface PrivacySettingsContentProps {
  /** The member's legal agreements (Terms acceptances). Rendered after the data export. */
  legal?: React.ReactNode;
  onCancelDeletion: () => Promise<boolean>;
  onDeletionScheduled: () => Promise<void>;
  onDownload: () => Promise<boolean>;
  onRequestDeletion: (values: {
    password?: string;
  }) => Promise<RequestAccountDeletionResult>;
  status: AccountDeletionStatus;
  userName: string;
  /** Who can see the member's activity: online status, reactions. Rendered above the data export. */
  visibility?: React.ReactNode;
}

export const PrivacySettingsHeading = () => {
  const t = useTranslations("core.auth.settings.privacy");
  const tSettings = useTranslations("core.auth.settings");

  return (
    <PageTitle
      className="mb-0"
      desc={t("desc")}
      h1={t("title")}
      subtitle={tSettings("title")}
    />
  );
};

const DownloadDataGroup = ({
  onDownload,
}: Pick<PrivacySettingsContentProps, "onDownload">) => {
  const t = useTranslations("core.auth.settings.privacy.export");
  const tErrors = useTranslations("core.global.errors");
  const [isPending, setIsPending] = React.useState(false);

  return (
    <SettingsGroup title={t("title")}>
      <li
        className={cn(
          SETTINGS_ROW,
          "flex-col items-start sm:flex-row sm:items-center",
        )}
      >
        <p className="text-muted-foreground flex-1 text-sm leading-relaxed text-pretty">
          {t("desc")}
        </p>
        <Button
          isLoading={isPending}
          onClick={async () => {
            setIsPending(true);
            try {
              const ok = await onDownload();
              if (ok) {
                toast.success(t("success"), {
                  description: t("success_desc"),
                });
              } else {
                toast.error(tErrors("title"), {
                  description: t("error_desc"),
                });
              }
            } finally {
              setIsPending(false);
            }
          }}
          variant="outline"
        >
          <DownloadIcon aria-hidden="true" />
          {t("action")}
        </Button>
      </li>
    </SettingsGroup>
  );
};

const PendingDeletion = ({
  onCancelDeletion,
  pending,
}: Pick<PrivacySettingsContentProps, "onCancelDeletion"> & {
  pending: NonNullable<AccountDeletionStatus["pending"]>;
}) => {
  const t = useTranslations("core.auth.settings.privacy.delete");
  const tErrors = useTranslations("core.global.errors");
  const format = useFormatter();
  const [isPending, setIsPending] = React.useState(false);

  return (
    <div className="flex flex-col gap-3 p-4">
      <Alert variant="warning">
        <AlertTitle>{t("pending_title")}</AlertTitle>
        <AlertDescription className="leading-relaxed text-pretty">
          {t("pending_desc", {
            date: format.dateTime(new Date(pending.scheduledAt), {
              dateStyle: "long",
              timeStyle: "short",
            }),
          })}
          {pending.source === "admin" ? ` ${t("pending_by_admin")}` : null}
        </AlertDescription>
      </Alert>
      <Button
        className="self-start"
        isLoading={isPending}
        onClick={async () => {
          setIsPending(true);
          try {
            if (await onCancelDeletion()) {
              toast.success(t("cancel_success"), {
                description: t("cancel_success_desc"),
              });
            } else {
              toast.error(tErrors("title"), {
                description: tErrors("internal_server_error"),
              });
            }
          } finally {
            setIsPending(false);
          }
        }}
      >
        <ShieldCheckIcon aria-hidden="true" />
        {t("cancel")}
      </Button>
    </div>
  );
};

const DAY_MS = 86_400_000;

const GraceCountdown = ({ graceDays }: { graceDays: number }) => {
  const t = useTranslations("core.auth.settings.privacy.delete");
  const format = useFormatter();
  const now = useNow();
  const scheduledAt = new Date(now.getTime() + graceDays * DAY_MS);

  return (
    <DeletionCountdown
      caption={t.rich("deleted_on", {
        date: () => (
          <time dateTime={scheduledAt.toISOString()}>
            {format.dateTime(scheduledAt, { dateStyle: "long" })}
          </time>
        ),
      })}
      days={graceDays}
      enter={staggeredEnter(2)}
      label={t("grace_days", { count: graceDays })}
    />
  );
};

const DeleteAccountGroup = ({
  onCancelDeletion,
  onDeletionScheduled,
  onRequestDeletion,
  status,
  userName,
}: Omit<PrivacySettingsContentProps, "onDownload">) => {
  const t = useTranslations("core.auth.settings.privacy.delete");
  const tErrors = useTranslations("core.global.errors");
  const shouldReduceMotion = useReducedMotion();
  const [open, setOpen] = React.useState(false);
  const isSubmittingRef = React.useRef(false);
  const [scheduledAt, setScheduledAt] = React.useState<Date | null>(null);
  const enter = (motion: MotionEnter) => (shouldReduceMotion ? {} : motion);

  if (status.pending) {
    return (
      <DangerZone title={t("danger_zone")}>
        <PendingDeletion
          onCancelDeletion={onCancelDeletion}
          pending={status.pending}
        />
      </DangerZone>
    );
  }

  if (status.staff || !status.allowed) {
    return (
      <DangerZone title={t("danger_zone")}>
        <DangerZoneItem
          description={
            <p>{t(status.staff ? "staff_desc" : "not_allowed_desc")}</p>
          }
          title={t(status.staff ? "staff_title" : "not_allowed_title")}
        />
      </DangerZone>
    );
  }

  return (
    <DangerZone title={t("danger_zone")}>
      <DangerZoneItem
        description={
          <>
            <p>{t("desc", { days: status.graceDays })}</p>
            <p>{t("what")}</p>
          </>
        }
        title={t("title")}
      >
        <MotionFeatures>
          <AlertDialog
            onOpenChange={value => {
              if (!isSubmittingRef.current) setOpen(value);
            }}
            open={open}
          >
            <AlertDialogTrigger render={<Button variant="destructive" />}>
              <Trash2Icon aria-hidden="true" />
              {t("action")}
            </AlertDialogTrigger>
            <AlertDialogContent size="sm">
              <AlertDialogHeader>
                <AlertDialogMedia className="bg-destructive/10 text-destructive rounded-full">
                  <m.span
                    {...enter(BADGE_ENTER)}
                    aria-hidden="true"
                    className="flex"
                  >
                    <Trash2Icon className="size-6" />
                  </m.span>
                </AlertDialogMedia>
                <AlertDialogTitle
                  render={<m.h2 {...enter(staggeredEnter(0))} />}
                >
                  {t("dialog_title")}
                </AlertDialogTitle>
                <AlertDialogDescription
                  className="leading-relaxed"
                  render={<m.p {...enter(staggeredEnter(1))} />}
                >
                  {t("dialog_desc")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              {status.graceDays > 0 ? (
                <GraceCountdown graceDays={status.graceDays} />
              ) : null}
              <m.div {...enter(staggeredEnter(3))}>
                <React.Suspense
                  fallback={
                    <div aria-busy="true" className="flex flex-col gap-6">
                      <span className="sr-only" role="status">
                        {t("dialog_title")}
                      </span>
                      <div className="flex flex-col gap-4">
                        {[0, 1].map(field => (
                          <div className="flex flex-col gap-3" key={field}>
                            <Skeleton className="h-3.5 w-32" />
                            <Skeleton className="h-9 w-full" />
                          </div>
                        ))}
                      </div>
                      <AlertDialogFooter className="group-data-[size=sm]/alert-dialog-content:flex sm:group-data-[size=sm]/alert-dialog-content:grid">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                      </AlertDialogFooter>
                    </div>
                  }
                >
                  <DeleteAccountForm
                    hasPassword={status.hasPassword}
                    onSubmit={async values => {
                      isSubmittingRef.current = true;
                      const result = await onRequestDeletion(values).finally(
                        () => {
                          isSubmittingRef.current = false;
                        },
                      );
                      if (result.ok) {
                        setOpen(false);
                        setScheduledAt(result.scheduledAt);

                        return result;
                      }

                      if (result.error === "reauthentication_required") {
                        setOpen(false);
                        toast.error(t("reauth_title"), {
                          description: t("reauth_desc"),
                        });
                      } else if (result.error === "staff_account") {
                        setOpen(false);
                        toast.error(t("staff_title"), {
                          description: t("staff_desc"),
                        });
                      } else if (result.error === "not_allowed") {
                        setOpen(false);
                        toast.error(t("not_allowed_title"), {
                          description: t("not_allowed_desc"),
                        });
                      } else if (result.error !== "invalid_password") {
                        toast.error(tErrors("title"), {
                          description: tErrors("internal_server_error"),
                        });
                      }

                      return result;
                    }}
                    userName={userName}
                  />
                </React.Suspense>
              </m.div>
            </AlertDialogContent>
          </AlertDialog>
        </MotionFeatures>
        <DeletionScheduledDialog
          onDone={onDeletionScheduled}
          scheduledAt={scheduledAt}
        />
      </DangerZoneItem>
    </DangerZone>
  );
};

export const PrivacySettingsContent = ({
  legal,
  onCancelDeletion,
  onDeletionScheduled,
  onDownload,
  onRequestDeletion,
  status,
  userName,
  visibility,
}: PrivacySettingsContentProps) => (
  <>
    <PrivacySettingsHeading />
    {visibility}
    <DownloadDataGroup onDownload={onDownload} />
    {legal}
    <DeleteAccountGroup
      onCancelDeletion={onCancelDeletion}
      onDeletionScheduled={onDeletionScheduled}
      onRequestDeletion={onRequestDeletion}
      status={status}
      userName={userName}
    />
  </>
);
