import { cn } from "cn";
import { DownloadIcon, ShieldCheckIcon, Trash2Icon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useFormatter, useTranslations } from "use-intl";

import { DangerZone, DangerZoneItem } from "@/components/danger-zone";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PageTitle } from "@/components/ui/page-title";
import { Skeleton } from "@/components/ui/skeleton";

import type {
  AccountDeletionStatus,
  RequestAccountDeletionResult,
} from "./privacy-query";

import { SETTINGS_ROW, SettingsGroup } from "../settings-group";

const DeleteAccountForm = React.lazy(async () =>
  import("./delete-account-form").then(module => ({
    default: module.DeleteAccountForm,
  })),
);

export interface PrivacySettingsContentProps {
  onCancelDeletion: () => Promise<boolean>;
  onDownload: () => Promise<boolean>;
  onRequestDeletion: (values: {
    password?: string;
  }) => Promise<RequestAccountDeletionResult>;
  status: AccountDeletionStatus;
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

const DeleteAccountGroup = ({
  onCancelDeletion,
  onRequestDeletion,
  status,
}: Omit<PrivacySettingsContentProps, "onDownload">) => {
  const t = useTranslations("core.auth.settings.privacy.delete");
  const tErrors = useTranslations("core.global.errors");
  const [open, setOpen] = React.useState(false);

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
        <Dialog onOpenChange={setOpen} open={open}>
          <DialogTrigger render={<Button variant="destructive" />}>
            <Trash2Icon aria-hidden="true" />
            {t("action")}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("dialog_title")}</DialogTitle>
              <DialogDescription className="leading-relaxed text-pretty">
                {t("dialog_desc")}
              </DialogDescription>
            </DialogHeader>
            <React.Suspense
              fallback={
                <div aria-busy="true" className="flex flex-col gap-4">
                  <span className="sr-only" role="status">
                    {t("dialog_title")}
                  </span>
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-9 w-40" />
                </div>
              }
            >
              <DeleteAccountForm
                hasPassword={status.hasPassword}
                onSubmit={async values => {
                  const result = await onRequestDeletion(values);
                  if (result.ok) {
                    setOpen(false);
                    toast.success(t("success"), {
                      description: t("success_desc"),
                    });

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
              />
            </React.Suspense>
          </DialogContent>
        </Dialog>
      </DangerZoneItem>
    </DangerZone>
  );
};

/** The member's GDPR self-service: a data export and account deletion. */
export const PrivacySettingsContent = ({
  onCancelDeletion,
  onDownload,
  onRequestDeletion,
  status,
}: PrivacySettingsContentProps) => (
  <>
    <PrivacySettingsHeading />
    <DownloadDataGroup onDownload={onDownload} />
    <DeleteAccountGroup
      onCancelDeletion={onCancelDeletion}
      onRequestDeletion={onRequestDeletion}
      status={status}
    />
  </>
);
