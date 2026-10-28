import { PencilIcon, PlusIcon, TriangleAlertIcon } from "lucide-react";
import React from "react";
import { useLocale, useTranslations } from "use-intl";

import type { DataTableNavigation } from "@/components/table/navigation";

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
import { resolveReasonText } from "@/views/moderation/report-reasons-query";
import { WarningDuration } from "@/views/moderation/warnings/warning-format";

import type { WarningReasonFormProps } from "./warning-reason-form";
import type { AdminWarningReason } from "./warnings-admin-api";

const WarningReasonForm = React.lazy(
  async () => await import("./warning-reason-form"),
);

export type WarningReasonSheetState =
  | { mode: "create" }
  | { mode: "edit"; reason: AdminWarningReason };

const STATIC_NAVIGATION: DataTableNavigation = {
  navigate: () => undefined,
  searchParams: new URLSearchParams(),
};

export const CreateWarningReasonButton = ({
  count,
  onCreate,
}: {
  count: number;
  onCreate: () => void;
}) => {
  const t = useTranslations("admin.moderation.warning_reasons");
  const atLimit = count >= WARNING_LIMITS.maxReasons;

  return (
    <Button
      disabled={atLimit}
      disabledTooltip={
        atLimit ? t("limit", { max: WARNING_LIMITS.maxReasons }) : undefined
      }
      onClick={onCreate}
    >
      <PlusIcon aria-hidden="true" />
      {t("create")}
    </Button>
  );
};

export const WarningReasonsContent = ({
  canEdit,
  onOpenSheet,
  onReorder,
  onSave,
  onSheetOpenChange,
  reasons,
  sheet,
  sheetOpen,
}: {
  canEdit: boolean;
  onOpenSheet: (state: WarningReasonSheetState) => void;
  onReorder: (ids: number[]) => Promise<void>;
  onSave: WarningReasonFormProps["onSave"];
  onSheetOpenChange: (open: boolean) => void;
  reasons: AdminWarningReason[];
  sheet: WarningReasonSheetState;
  sheetOpen: boolean;
}) => {
  const t = useTranslations("admin.moderation.warning_reasons");
  const locale = useLocale();

  return (
    <>
      <DataTableNavigationProvider value={STATIC_NAVIGATION}>
        <ContentDataTable<AdminWarningReason>
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
              accessorKey: "points",
              cell: ({ row }) => (
                <span className="tabular-nums">{row.points}</span>
              ),
              className: "w-24",
              header: t("columns.points"),
            },
            {
              accessorKey: "expiresAfterHours",
              cell: ({ row }) =>
                row.expiresAfterHours === null ? (
                  <span className="text-muted-foreground text-sm">
                    {t("never")}
                  </span>
                ) : (
                  <WarningDuration hours={row.expiresAfterHours} />
                ),
              className: "w-32",
              header: t("columns.expires"),
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
              cell: ({ row }) => {
                const title = resolveReasonText(row.title, locale);

                return canEdit ? (
                  <TooltipWithContent text={t("edit")}>
                    <Button
                      aria-label={`${t("edit")}: ${title}`}
                      onClick={() => {
                        onOpenSheet({ mode: "edit", reason: row });
                      }}
                      size="icon"
                      variant="ghost"
                    >
                      <PencilIcon aria-hidden="true" />
                    </Button>
                  </TooltipWithContent>
                ) : null;
              },
              className: "w-16",
              header: "",
              id: "actions",
            },
          ]}
          customNoResults={{
            description: t("empty_desc"),
            icon: <TriangleAlertIcon />,
            title: t("empty_title"),
          }}
          edges={reasons}
          id="warning-reasons-table"
          order={{ defaultOrder: { column: "position", order: "asc" } }}
          reorderable={{
            disabled: !canEdit,
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
            <WarningReasonForm
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
    </>
  );
};
