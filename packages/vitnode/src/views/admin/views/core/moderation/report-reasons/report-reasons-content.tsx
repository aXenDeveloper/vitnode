import { FlagIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "use-intl";

import type { DataTableNavigation } from "@/components/table/navigation";
import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";

import { ContentDataTable } from "@/components/table/content";
import { DataTableNavigationProvider } from "@/components/table/navigation";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { MODERATION_LIMITS } from "@/lib/moderation/const";
import { resolveReasonText } from "@/views/moderation/report-reasons-query";

import type { ReportReasonFormProps } from "./report-reason-form";
import type { AdminReportReason } from "./report-reasons-query";

const ReportReasonForm = React.lazy(
  async () => await import("./report-reason-form"),
);

export interface ReportReasonsContentProps {
  onDelete: (id: number) => Promise<AdminMutationResult<true>>;
  onReorder: (ids: number[]) => Promise<void>;
  onSave: ReportReasonFormProps["onSave"];
  permissions: { canDelete: boolean; canEdit: boolean };
  reasons: AdminReportReason[];
}

export type ReportReasonSheetState =
  | { mode: "create" }
  | { mode: "edit"; reason: AdminReportReason };

const STATIC_NAVIGATION: DataTableNavigation = {
  navigate: () => undefined,
  searchParams: new URLSearchParams(),
};

const DeleteReasonDialog = ({
  onClose,
  onDelete,
  reason,
}: {
  onClose: () => void;
  onDelete: ReportReasonsContentProps["onDelete"];
  reason: AdminReportReason | null;
}) => {
  const t = useTranslations("admin.moderation.report_reasons.delete");
  const locale = useLocale();
  const [isPending, startTransition] = React.useTransition();
  const title = reason ? resolveReasonText(reason.title, locale) : "";

  return (
    <AlertDialog
      onOpenChange={open => {
        if (!open) onClose();
      }}
      open={reason !== null}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-balance">
            {t("title", { reason: title })}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-pretty">
            {t("desc")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <Button
            isLoading={isPending}
            onClick={() => {
              if (!reason) return;
              startTransition(async () => {
                const result = await onDelete(reason.id);
                if ("error" in result) {
                  toast.error(t("error"), {
                    description:
                      result.error.status === 409
                        ? t("last_reason")
                        : t("unknown"),
                  });

                  return;
                }
                toast.success(t("success"), {
                  description: t("success_desc", { reason: title }),
                });
                onClose();
              });
            }}
            type="button"
            variant="destructive"
          >
            {t("confirm")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export const CreateReportReasonButton = ({
  count,
  onCreate,
}: {
  count: number;
  onCreate: () => void;
}) => {
  const t = useTranslations("admin.moderation.report_reasons");
  const atLimit = count >= MODERATION_LIMITS.maxReportReasons;

  return (
    <Button
      disabled={atLimit}
      disabledTooltip={
        atLimit
          ? t("limit", { max: MODERATION_LIMITS.maxReportReasons })
          : undefined
      }
      onClick={onCreate}
    >
      <PlusIcon />
      {t("create")}
    </Button>
  );
};

export const ReportReasonsContent = ({
  onDelete,
  onOpenSheet,
  onReorder,
  onSave,
  onSheetOpenChange,
  permissions,
  reasons,
  sheet,
  sheetOpen,
}: ReportReasonsContentProps & {
  onOpenSheet: (state: ReportReasonSheetState) => void;
  onSheetOpenChange: (open: boolean) => void;
  sheet: ReportReasonSheetState;
  sheetOpen: boolean;
}) => {
  const t = useTranslations("admin.moderation.report_reasons");
  const locale = useLocale();
  const [deleting, setDeleting] = React.useState<AdminReportReason | null>(
    null,
  );

  return (
    <>
      <DataTableNavigationProvider value={STATIC_NAVIGATION}>
        <ContentDataTable<AdminReportReason>
          columns={[
            {
              accessorKey: "title",
              cell: ({ row }) => {
                const description = resolveReasonText(row.description, locale);

                return (
                  <span className="flex min-w-0 flex-col gap-0.5 whitespace-normal">
                    <span className="font-medium text-pretty">
                      {resolveReasonText(row.title, locale)}
                    </span>
                    {description ? (
                      <span className="text-muted-foreground text-sm leading-relaxed text-pretty">
                        {description}
                      </span>
                    ) : null}
                  </span>
                );
              },
              header: t("columns.reason"),
            },
            {
              accessorKey: "requiresDetails",
              cell: ({ row }) =>
                row.requiresDetails ? (
                  <Badge variant="warning">{t("details_required")}</Badge>
                ) : (
                  <span className="text-muted-foreground text-sm">
                    {t("details_optional")}
                  </span>
                ),
              className: "w-32",
              header: t("columns.details"),
            },
            {
              align: "right",
              cell: ({ row }) => {
                const title = resolveReasonText(row.title, locale);

                return (
                  <div
                    aria-label={t("actions.label", { reason: title })}
                    className="flex justify-end gap-1"
                    role="group"
                  >
                    {permissions.canEdit ? (
                      <TooltipWithContent text={t("actions.edit")}>
                        <Button
                          aria-label={`${t("actions.edit")}: ${title}`}
                          onClick={() => {
                            onOpenSheet({ mode: "edit", reason: row });
                          }}
                          size="icon"
                          variant="ghost"
                        >
                          <PencilIcon />
                        </Button>
                      </TooltipWithContent>
                    ) : null}
                    {permissions.canDelete ? (
                      <TooltipWithContent text={t("actions.delete")}>
                        <Button
                          aria-label={`${t("actions.delete")}: ${title}`}
                          onClick={() => {
                            setDeleting(row);
                          }}
                          size="icon"
                          variant="destructive"
                        >
                          <Trash2Icon />
                        </Button>
                      </TooltipWithContent>
                    ) : null}
                  </div>
                );
              },
              className: "w-24",
              header: "",
              id: "actions",
            },
          ]}
          customNoResults={{
            description: t("desc"),
            icon: <FlagIcon />,
            title: t("title"),
          }}
          edges={reasons}
          id="report-reasons-table"
          order={{ defaultOrder: { column: "position", order: "asc" } }}
          reorderable={{
            disabled: !permissions.canEdit,
            getRowLabel: row => resolveReasonText(row.title, locale),
            onReorder,
          }}
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
            <ReportReasonForm
              key={sheet.mode === "edit" ? sheet.reason.id : "new"}
              onSave={onSave}
              onSaved={() => {
                onSheetOpenChange(false);
              }}
              reason={sheet.mode === "edit" ? sheet.reason : undefined}
            />
          </React.Suspense>
        </SheetContent>
      </Sheet>

      <DeleteReasonDialog
        onClose={() => {
          setDeleting(null);
        }}
        onDelete={onDelete}
        reason={deleting}
      />
    </>
  );
};
