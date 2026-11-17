import {
  CircleCheckIcon,
  EyeIcon,
  PencilIcon,
  PowerIcon,
  PowerOffIcon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useFormatter, useLocale, useTranslations } from "use-intl";

import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { DateFormat } from "@/components/date-format";
import { useLogo } from "@/components/logo-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SiteOfflineContent } from "@/views/site-offline/site-offline-content";

import type { SiteStatusFormMode } from "./site-status-form-content";
import type {
  AdminSiteStatus,
  AdminSiteStatusInput,
} from "./site-status-query";

import { preloadSiteStatusForm, SiteStatusSheet } from "./site-status-sheet";

export const SiteStatusContent = ({
  canManage,
  data,
  fetchedAt,
  onSave,
}: {
  canManage: boolean;
  data: AdminSiteStatus;
  /** When `data` arrived (`dataUpdatedAt`): the preview's countdown runs from it, the same on the server and in the browser. */
  fetchedAt: number;
  onSave: (values: AdminSiteStatusInput) => Promise<AdminMutationResult<true>>;
}) => {
  const t = useTranslations("admin.system.site_status");
  const tError = useTranslations("core.global.errors");
  const format = useFormatter();
  const locale = useLocale();
  const logo = useLogo();
  const [sheetMode, setSheetMode] = React.useState<null | SiteStatusFormMode>(
    null,
  );

  const turnOn = async ({ onClose }: { onClose: () => void }) => {
    const opensAtPassed =
      data.opensAt !== null && Date.parse(data.opensAt) <= Date.now();
    const result = await onSave({
      message: data.message,
      offline: false,
      opensAt: opensAtPassed ? null : data.opensAt,
      showCountdown: data.showCountdown,
    });
    if ("error" in result) {
      toast.error(tError("title"), {
        description: result.error.message ?? tError("internal_server_error"),
      });

      return;
    }

    onClose();
    toast.success(t("turned_on.title"), { description: t("turned_on.desc") });
  };

  const openSheet = (mode: SiteStatusFormMode) => () => {
    setSheetMode(mode);
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <span
              aria-hidden="true"
              className={
                data.offline
                  ? "bg-warn/10 text-warn flex size-12 shrink-0 items-center justify-center rounded-xl"
                  : "bg-success/10 text-success flex size-12 shrink-0 items-center justify-center rounded-xl"
              }
            >
              {data.offline ? (
                <PowerOffIcon className="size-6" />
              ) : (
                <CircleCheckIcon className="size-6" />
              )}
            </span>
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-lg text-balance">
                  {data.offline
                    ? t("card.offline.title")
                    : t("card.online.title")}
                </CardTitle>
                <Badge variant={data.offline ? "warning" : "success"}>
                  {data.offline ? t("badge.offline") : t("badge.online")}
                </Badge>
              </div>
              <CardDescription className="leading-relaxed text-pretty">
                {data.offline ? t("card.offline.desc") : t("card.online.desc")}
              </CardDescription>
            </div>
          </div>

          {canManage ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={openSheet("edit")}
                onFocus={preloadSiteStatusForm}
                onPointerEnter={preloadSiteStatusForm}
                variant="outline"
              >
                <PencilIcon aria-hidden="true" />
                {t("actions.edit")}
              </Button>
              {data.offline ? (
                <ConfirmActionAlertDialog
                  description={t("turn_on_confirm.desc")}
                  icon={<PowerIcon />}
                  onSubmit={turnOn}
                  submitVariant="default"
                  textSubmit={
                    <>
                      <PowerIcon aria-hidden="true" />
                      {t("actions.turn_on")}
                    </>
                  }
                  title={t("turn_on_confirm.title")}
                >
                  <Button>
                    <PowerIcon aria-hidden="true" />
                    {t("actions.turn_on")}
                  </Button>
                </ConfirmActionAlertDialog>
              ) : (
                <Button
                  onClick={openSheet("turn_off")}
                  onFocus={preloadSiteStatusForm}
                  onPointerEnter={preloadSiteStatusForm}
                  variant="destructive"
                >
                  <PowerOffIcon aria-hidden="true" />
                  {t("actions.turn_off")}
                </Button>
              )}
            </div>
          ) : null}
        </CardHeader>

        <CardContent>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground">
                {data.offline
                  ? t("details.offline_since")
                  : t("details.last_change")}
              </dt>
              <dd className="font-medium">
                {data.changedAt ? (
                  <>
                    <DateFormat date={data.changedAt} />
                    {data.changedBy
                      ? ` · ${t("details.by", { name: data.changedBy.name })}`
                      : null}
                  </>
                ) : (
                  t("details.never")
                )}
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground">{t("details.opens_at")}</dt>
              <dd className="font-medium">
                {data.opensAt
                  ? format.dateTime(new Date(data.opensAt), {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })
                  : t("details.no_opening_time")}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <EyeIcon aria-hidden="true" className="size-4" />
            {t("preview.title")}
          </CardTitle>
          <CardDescription className="leading-relaxed text-pretty">
            {t("preview.desc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/40 flex justify-center rounded-lg border px-4 py-10 sm:py-12">
            <SiteOfflineContent
              fetchedAt={fetchedAt}
              headingLevel={2}
              language={locale}
              logo={logo}
              status={{
                message: data.message,
                opensAt: data.opensAt,
                serverNow: new Date(fetchedAt).toISOString(),
                showCountdown: data.showCountdown,
              }}
            />
          </div>
        </CardContent>
      </Card>

      <SiteStatusSheet
        canManage={canManage}
        data={data}
        mode={sheetMode}
        onOpenChange={setSheetMode}
        onSave={onSave}
      />
    </div>
  );
};
