import { GaugeIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { DataTableNavigation } from "@/components/table/navigation";
import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { ContentDataTable } from "@/components/table/content";
import { DataTableNavigationProvider } from "@/components/table/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { TooltipWithContent } from "@/components/ui/tooltip";
import { WARNING_LIMITS } from "@/lib/moderation/warnings";
import { WarningDuration } from "@/views/moderation/warnings/warning-format";

import type { WarningThresholdFormProps } from "./warning-threshold-form";
import type { AdminWarningThreshold } from "./warnings-admin-api";

const WarningThresholdForm = React.lazy(
  async () => await import("./warning-threshold-form"),
);

export type WarningThresholdSheetState =
  | { mode: "create" }
  | { mode: "edit"; threshold: AdminWarningThreshold };

const STATIC_NAVIGATION: DataTableNavigation = {
  navigate: () => undefined,
  searchParams: new URLSearchParams(),
};

export const CreateWarningThresholdButton = ({
  count,
  onCreate,
}: {
  count: number;
  onCreate: () => void;
}) => {
  const t = useTranslations("admin.moderation.warning_thresholds");
  const atLimit = count >= WARNING_LIMITS.maxThresholds;

  return (
    <Button
      disabled={atLimit}
      disabledTooltip={
        atLimit ? t("limit", { max: WARNING_LIMITS.maxThresholds }) : undefined
      }
      onClick={onCreate}
    >
      <PlusIcon aria-hidden="true" />
      {t("create")}
    </Button>
  );
};

export const WarningThresholdsContent = ({
  canEdit,
  onDelete,
  onOpenSheet,
  onSave,
  onSheetOpenChange,
  sheet,
  sheetOpen,
  thresholds,
}: {
  canEdit: boolean;
  onDelete: (id: number) => Promise<AdminMutationResult<true>>;
  onOpenSheet: (state: WarningThresholdSheetState) => void;
  onSave: WarningThresholdFormProps["onSave"];
  onSheetOpenChange: (open: boolean) => void;
  sheet: WarningThresholdSheetState;
  sheetOpen: boolean;
  thresholds: AdminWarningThreshold[];
}) => {
  const t = useTranslations("admin.moderation.warning_thresholds");
  const [deleting, setDeleting] = React.useState<AdminWarningThreshold | null>(
    null,
  );

  return (
    <>
      <DataTableNavigationProvider value={STATIC_NAVIGATION}>
        <ContentDataTable<AdminWarningThreshold>
          columns={[
            {
              accessorKey: "points",
              cell: ({ row }) => (
                <span className="font-medium tabular-nums">
                  {t("at_points", { points: row.points })}
                </span>
              ),
              header: t("columns.points"),
            },
            {
              accessorKey: "action",
              cell: ({ row }) =>
                row.action === "suspend_temporary" && row.durationHours ? (
                  <span>
                    {t("suspend_for")}{" "}
                    <WarningDuration hours={row.durationHours} />
                  </span>
                ) : (
                  <span>{t("suspend_indefinitely")}</span>
                ),
              header: t("columns.action"),
            },
            {
              accessorKey: "enabled",
              cell: ({ row }) =>
                row.enabled ? (
                  <Badge variant="success">{t("enabled")}</Badge>
                ) : (
                  <Badge variant="secondary">{t("disabled")}</Badge>
                ),
              className: "w-28",
              header: t("columns.status"),
            },
            {
              align: "right",
              cell: ({ row }) =>
                canEdit ? (
                  <div
                    aria-label={t("actions_label", { points: row.points })}
                    className="flex justify-end gap-1"
                    role="group"
                  >
                    <TooltipWithContent text={t("edit")}>
                      <Button
                        aria-label={t("edit")}
                        onClick={() => {
                          onOpenSheet({ mode: "edit", threshold: row });
                        }}
                        size="icon"
                        variant="ghost"
                      >
                        <PencilIcon aria-hidden="true" />
                      </Button>
                    </TooltipWithContent>
                    <TooltipWithContent text={t("delete.button")}>
                      <Button
                        aria-label={t("delete.button")}
                        onClick={() => {
                          setDeleting(row);
                        }}
                        size="icon"
                        variant="destructive"
                      >
                        <Trash2Icon aria-hidden="true" />
                      </Button>
                    </TooltipWithContent>
                  </div>
                ) : null,
              className: "w-24",
              header: "",
              id: "actions",
            },
          ]}
          customNoResults={{
            description: t("empty_desc"),
            icon: <GaugeIcon />,
            title: t("empty_title"),
          }}
          edges={thresholds}
          id="warning-thresholds-table"
          order={{ defaultOrder: { column: "points", order: "asc" } }}
        />
      </DataTableNavigationProvider>

      <Sheet onOpenChange={onSheetOpenChange} open={sheetOpen}>
        <SheetContent className="w-full gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
          <SheetHeader className="border-b pe-14">
            <SheetTitle className="text-balance">
              {sheet.mode === "edit"
                ? t("form.edit_title")
                : t("form.create_title")}
            </SheetTitle>
            <SheetDescription className="leading-relaxed text-pretty">
              {t("form.sheet_desc")}
            </SheetDescription>
          </SheetHeader>
          <React.Suspense
            fallback={
              <div className="flex flex-1 items-center justify-center">
                <Spinner size="xl" />
              </div>
            }
          >
            <WarningThresholdForm
              key={sheet.mode === "edit" ? sheet.threshold.id : "new"}
              onSave={onSave}
              onSaved={() => {
                onSheetOpenChange(false);
              }}
              threshold={sheet.mode === "edit" ? sheet.threshold : undefined}
            />
          </React.Suspense>
        </SheetContent>
      </Sheet>

      <ConfirmActionAlertDialog
        description={t("delete.desc")}
        icon={<Trash2Icon />}
        onOpenChange={open => {
          if (!open) setDeleting(null);
        }}
        onSubmit={async ({ onClose }) => {
          if (!deleting) return;
          const result = await onDelete(deleting.id);
          if ("error" in result) {
            toast.error(t("delete.error"));

            return;
          }
          toast.success(t("delete.success"), {
            description: t("delete.success_desc", { points: deleting.points }),
          });
          onClose();
        }}
        open={deleting !== null}
        submitVariant="destructive"
        textSubmit={
          <>
            <Trash2Icon aria-hidden="true" />
            {t("delete.button")}
          </>
        }
        title={t("delete.title", { points: deleting?.points ?? 0 })}
      />
    </>
  );
};
