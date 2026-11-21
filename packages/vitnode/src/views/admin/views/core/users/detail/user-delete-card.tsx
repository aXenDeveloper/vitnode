import { BanIcon, RotateCwIcon, Trash2Icon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { DangerZone, DangerZoneItem } from "@/components/danger-zone";
import { DateFormat } from "@/components/date-format";
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
import { Skeleton } from "@/components/ui/skeleton";

import type { AdminMutationResult } from "../../shared/admin-mutation";
import type { DeleteAdminUserResult } from "../deletions/deletions-mutations";
import type { AdminUserDetail } from "./user-query";

import { isAdminMutationError } from "../../shared/admin-mutation";

const UserDeleteForm = React.lazy(async () =>
  import("./user-delete-form").then(module => ({
    default: module.UserDeleteForm,
  })),
);

export interface UserDeleteCardProps {
  onDelete: (args: {
    immediately: boolean;
  }) => Promise<AdminMutationResult<DeleteAdminUserResult>>;
  /** Runs after an account was erased - leave the page, it no longer exists. */
  onErased: () => Promise<void> | void;
  user: AdminUserDetail;
}

export interface UserDeletionNoticeProps {
  onCancel: (deletionId: number) => Promise<AdminMutationResult<true>>;
  /** Runs after an account was erased - leave the page, it no longer exists. */
  onErased: () => Promise<void> | void;
  /** Erases now, for a request whose erasure failed. */
  onRetry: (
    deletionId: number,
  ) => Promise<AdminMutationResult<{ status: "completed" | "failed" }>>;
  user: AdminUserDetail;
}

const useDeletionErrorToast = () => {
  const t = useTranslations("admin.user.show.delete");
  const tErrors = useTranslations("core.global.errors");

  return (status: number) => {
    toast.error(status === 409 ? t("failed") : tErrors("title"), {
      description:
        status === 409
          ? t("failed_desc")
          : status === 400
            ? t("self_desc")
            : tErrors("internal_server_error"),
    });
  };
};

export const UserDeletionNotice = ({
  onCancel,
  onErased,
  onRetry,
  user,
}: UserDeletionNoticeProps) => {
  const t = useTranslations("admin.user.show.delete");
  const showError = useDeletionErrorToast();
  const pending = user.pendingDeletion;
  if (!pending) return null;
  const failed = pending.status === "failed";

  return (
    <Alert icon={<Trash2Icon />} variant={failed ? "destructive" : "warning"}>
      <AlertTitle>
        {failed
          ? t("failed_title", { attempts: pending.attempts })
          : t("pending_title")}
      </AlertTitle>
      <AlertDescription className="flex flex-col gap-1">
        {failed ? (
          <>
            {pending.lastError ? (
              <p className="text-destructive [&_code]:bg-destructive/10 break-words [&_code]:rounded [&_code]:px-1 [&_code]:font-mono [&_code]:text-xs">
                {pending.lastError}
              </p>
            ) : null}
            <p>{t("failed_hint")}</p>
          </>
        ) : (
          <p>
            {t(
              pending.source === "admin"
                ? "scheduled_by_admin"
                : "scheduled_by_member",
            )}{" "}
            <DateFormat date={pending.scheduledAt} showFullDate />
          </p>
        )}
      </AlertDescription>
      <div className="flex flex-wrap gap-2 pt-2">
        {failed ? (
          <ConfirmActionAlertDialog
            description={t("retry.desc", { name: user.name })}
            icon={<RotateCwIcon />}
            onSubmit={async ({ onClose }) => {
              const result = await onRetry(pending.id);
              onClose();
              if (isAdminMutationError(result)) {
                showError(result.error.status);

                return;
              }
              if (result.data.status === "failed") {
                toast.error(t("failed"), { description: t("failed_desc") });

                return;
              }
              toast.success(t("now.success"), {
                description: t("now.success_desc", { name: user.name }),
              });
              await onErased();
            }}
            textSubmit={
              <>
                <RotateCwIcon aria-hidden="true" />
                {t("retry.confirm")}
              </>
            }
            title={t("retry.title")}
          >
            <Button size="sm" variant="destructive">
              <RotateCwIcon aria-hidden="true" />
              {t("retry.action")}
            </Button>
          </ConfirmActionAlertDialog>
        ) : null}
        <ConfirmActionAlertDialog
          description={t("cancel.desc", { name: user.name })}
          icon={<BanIcon />}
          onSubmit={async ({ onClose }) => {
            const result = await onCancel(pending.id);
            onClose();
            if (isAdminMutationError(result)) {
              showError(result.error.status);

              return;
            }
            toast.success(t("cancel.success"), {
              description: t("cancel.success_desc", { name: user.name }),
            });
          }}
          submitVariant="default"
          textSubmit={
            <>
              <BanIcon aria-hidden="true" />
              {t("cancel.confirm")}
            </>
          }
          title={t("cancel.title")}
        >
          <Button size="sm" variant="outline">
            <BanIcon aria-hidden="true" />
            {t("cancel.action")}
          </Button>
        </ConfirmActionAlertDialog>
      </div>
    </Alert>
  );
};

export const UserDeleteCard = ({
  onDelete,
  onErased,
  user,
}: UserDeleteCardProps) => {
  const t = useTranslations("admin.user.show.delete");
  const showError = useDeletionErrorToast();

  if (user.pendingDeletion?.status === "failed") return null;

  return (
    <DangerZone title={t("danger_zone")}>
      <DangerZoneItem description={<p>{t("desc")}</p>} title={t("title")}>
        <Dialog>
          <DialogTrigger render={<Button size="sm" variant="destructive" />}>
            <Trash2Icon aria-hidden="true" />
            {t("action")}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {t("dialog_title", { name: user.name })}
              </DialogTitle>
              <DialogDescription className="leading-relaxed text-pretty">
                {t("dialog_desc")}
              </DialogDescription>
            </DialogHeader>
            <React.Suspense
              fallback={
                <div aria-busy="true" className="flex flex-col gap-4">
                  <span className="sr-only" role="status">
                    {t("dialog_title", { name: user.name })}
                  </span>
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-9 w-40" />
                </div>
              }
            >
              <UserDeleteForm
                onDelete={onDelete}
                onErased={onErased}
                onFailure={showError}
                user={user}
              />
            </React.Suspense>
          </DialogContent>
        </Dialog>
      </DangerZoneItem>
    </DangerZone>
  );
};
