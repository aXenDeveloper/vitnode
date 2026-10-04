import {
  BrushCleaningIcon,
  MailCheckIcon,
  SearchCheckIcon,
  WrenchIcon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import type { NotificationsAdminActions } from "./notifications-mutations";

export const NotificationsMaintenanceCard = ({
  actions,
  canManage,
  emailConfigured,
  retentionDays,
}: {
  actions: Pick<
    NotificationsAdminActions,
    "cleanup" | "reconcile" | "sendTestEmail"
  >;
  canManage: boolean;
  emailConfigured: boolean;
  retentionDays: number;
}) => {
  const t = useTranslations("admin.system.notifications.maintenance");
  const tError = useTranslations("core.global.errors");
  const [mismatched, setMismatched] = React.useState<null | number>(null);

  const showError = () => {
    toast.error(tError("title"), {
      description: tError("internal_server_error"),
    });
  };

  const [, sendTestEmail, isSendingTestEmail] = React.useActionState(
    async () => {
      const mutation = await actions.sendTestEmail();

      if (mutation.error !== undefined) {
        if (mutation.status === 400) {
          toast.error(tError("title"), {
            description: t("test_email.not_configured"),
          });
        } else showError();

        return null;
      }

      toast.success(t("test_email.success"), {
        description: t("test_email.success_desc", {
          id: mutation.data.deliveryId,
        }),
      });

      return null;
    },
    null,
  );

  const [, checkCounts, isChecking] = React.useActionState(async () => {
    const mutation = await actions.reconcile({ dryRun: true });

    if (mutation.error !== undefined) {
      showError();

      return null;
    }

    setMismatched(mutation.data.mismatched);

    return null;
  }, null);

  const [, cleanup, isCleaning] = React.useActionState(async () => {
    const mutation = await actions.cleanup();

    if (mutation.error !== undefined) {
      showError();

      return null;
    }

    toast.success(t("cleanup.success"), {
      description: t("cleanup.success_desc"),
    });

    return null;
  }, null);

  return (
    <Card aria-labelledby="notifications-maintenance" role="region">
      <CardHeader>
        <CardTitle>
          <h2
            className="flex items-center gap-2 text-balance"
            id="notifications-maintenance"
          >
            <WrenchIcon aria-hidden className="text-muted-foreground size-4" />
            {t("title")}
          </h2>
        </CardTitle>
        <CardDescription className="leading-relaxed text-pretty">
          {canManage ? t("desc") : t("read_only")}
        </CardDescription>
      </CardHeader>

      {canManage ? (
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
              {t("test_email.desc")}
            </p>
            <form action={sendTestEmail}>
              <Button
                disabled={!emailConfigured}
                isLoading={isSendingTestEmail}
                type="submit"
                variant="outline"
              >
                <MailCheckIcon aria-hidden />
                {t("test_email.label")}
              </Button>
            </form>
            {emailConfigured ? null : (
              <p className="text-muted-foreground text-sm leading-relaxed">
                {t("test_email.not_configured")}
              </p>
            )}
          </div>

          <Separator />

          <div className="flex flex-col gap-2">
            <h3 className="font-medium">{t("reconcile.title")}</h3>
            <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
              {t("reconcile.desc")}
            </p>
            <div className="flex flex-wrap gap-2">
              <form action={checkCounts}>
                <Button isLoading={isChecking} type="submit" variant="outline">
                  <SearchCheckIcon aria-hidden />
                  {t("reconcile.check")}
                </Button>
              </form>
              <ConfirmActionAlertDialog
                description={t("reconcile.confirm_desc")}
                onSubmit={async ({ onClose }) => {
                  const mutation = await actions.reconcile({ dryRun: false });

                  if (mutation.error !== undefined) {
                    showError();

                    return;
                  }

                  onClose();
                  setMismatched(null);
                  toast.success(t("reconcile.fixed"), {
                    description: t("reconcile.fixed_desc", {
                      count: mutation.data.corrected,
                    }),
                  });
                }}
                submitVariant="default"
                textSubmit={t("reconcile.confirm_submit")}
                title={t("reconcile.confirm_title")}
              >
                <Button variant="outline">{t("reconcile.fix")}</Button>
              </ConfirmActionAlertDialog>
            </div>
            <p aria-live="polite" className="text-sm leading-relaxed">
              {mismatched === null
                ? null
                : mismatched === 0
                  ? t("reconcile.result_ok")
                  : t("reconcile.result_mismatched", { count: mismatched })}
            </p>
          </div>

          <Separator />

          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
              {t("retention", { days: retentionDays })}
            </p>
            <form action={cleanup}>
              <Button isLoading={isCleaning} type="submit" variant="outline">
                <BrushCleaningIcon aria-hidden />
                {t("cleanup.label")}
              </Button>
            </form>
          </div>
        </CardContent>
      ) : (
        <CardContent>
          <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
            {t("retention", { days: retentionDays })}
          </p>
        </CardContent>
      )}
    </Card>
  );
};
