import { HistoryIcon } from "lucide-react";
import React from "react";
import { useLocale, useTranslations } from "use-intl";

import { DateFormat } from "@/components/date-format";
import { ContentDataTable } from "@/components/table/content";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import {
  type AiActionTranslate,
  withTranslatedAiActionText,
} from "@/lib/ai/action-text";
import { formatAiPoints, formatAiUsd } from "@/lib/ai/format-points";
import { AI_RUN_STATUS_LIST } from "@/lib/ai/run-status";

import type {
  AdminAiAction,
  AdminAiHistoryPage,
  AdminAiModel,
  AdminAiRunRow,
  AiHistoryFilters,
} from "../ai-query";
import type { AiRunDetailProps } from "./run-detail-content";

import {
  AiActionLabel,
  AiCostSourceBadge,
  AiRunStatusBadge,
  AiUsd,
} from "../ai-labels";
import { AI_HISTORY_ACTOR_TYPES } from "../ai-query";

const AiRunDetailContent = React.lazy(async () =>
  import("./run-detail-content").then(module => ({
    default: module.AiRunDetailContent,
  })),
);

export interface AiHistoryTableProps {
  actions: AdminAiAction[];
  data: AdminAiHistoryPage;
  filters: AiHistoryFilters;
  models: AdminAiModel[];
  onFilterChange: (filters: AiHistoryFilters) => void;
  runQuery: AiRunDetailProps["runQuery"];
}

const FilterSelect = ({
  id,
  label,
  onChange,
  options,
  value,
}: {
  id: string;
  label: string;
  onChange: (value: string | undefined) => void;
  options: { label: string; value: string }[];
  value: string | undefined;
}) => {
  const t = useTranslations("admin.ai.history.filters");

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect
        className="w-full sm:w-48"
        id={id}
        onChange={event => {
          onChange(event.target.value || undefined);
        }}
        size="sm"
        value={value ?? ""}
      >
        <NativeSelectOption value="">{t("all")}</NativeSelectOption>
        {options.map(option => (
          <NativeSelectOption key={option.value} value={option.value}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
};

const AiHistoryFiltersContent = ({
  actions,
  filters,
  models,
  onFilterChange,
}: Pick<
  AiHistoryTableProps,
  "actions" | "filters" | "models" | "onFilterChange"
>) => {
  const t = useTranslations("admin.ai.history.filters");
  const tStatus = useTranslations("admin.ai.status");
  const tOrigin = useTranslations("admin.ai.origin");
  const set =
    <TKey extends keyof AiHistoryFilters>(key: TKey) =>
    (value: string | undefined) => {
      onFilterChange({ ...filters, [key]: value });
    };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <FilterSelect
        id="ai-history-status"
        label={t("status")}
        onChange={set("status")}
        options={AI_RUN_STATUS_LIST.map(status => ({
          label: tStatus(status),
          value: status,
        }))}
        value={filters.status}
      />
      <FilterSelect
        id="ai-history-actor"
        label={t("actor")}
        onChange={set("actorType")}
        options={AI_HISTORY_ACTOR_TYPES.map(actor => ({
          label: tOrigin(actor),
          value: actor,
        }))}
        value={filters.actorType}
      />
      <FilterSelect
        id="ai-history-action"
        label={t("action")}
        onChange={set("action")}
        options={actions.map(action => ({
          label: action.title,
          value: action.key,
        }))}
        value={filters.action}
      />
      <FilterSelect
        id="ai-history-model"
        label={t("model")}
        onChange={set("modelId")}
        options={models.map(model => ({ label: model.name, value: model.id }))}
        value={filters.modelId}
      />
    </div>
  );
};

const AiRunCost = ({ row }: { row: AdminAiRunRow }) => {
  const t = useTranslations("admin.ai.history");
  const locale = useLocale();

  return (
    <div className="flex flex-col items-end gap-1">
      <AiUsd value={row.costUsd} />
      {row.costUsd === null && row.chargedUsd !== null ? (
        <span className="text-muted-foreground text-xs">
          {t("charged_reservation", {
            amount: formatAiUsd(row.chargedUsd, locale),
          })}
        </span>
      ) : null}
      {row.costSource ? <AiCostSourceBadge source={row.costSource} /> : null}
    </div>
  );
};

export const AiHistoryTableContent = ({
  actions,
  data,
  filters,
  models,
  onFilterChange,
  runQuery,
}: AiHistoryTableProps) => {
  const t = useTranslations("admin.ai.history");
  const tOrigin = useTranslations("admin.ai.origin");
  const tAll = useTranslations() as unknown as AiActionTranslate;
  const locale = useLocale();
  const [openRun, setOpenRun] = React.useState<AdminAiRunRow | null>(null);
  const translatedActions = actions.map(action =>
    withTranslatedAiActionText(tAll, action),
  );
  const titles = new Map(
    translatedActions.map(action => [action.key, action.title]),
  );
  const modelNames = React.useMemo(
    () => new Map(models.map(model => [model.id, model.name])),
    [models],
  );

  return (
    <>
      <ContentDataTable<AdminAiRunRow>
        columns={[
          {
            accessorKey: "actionKey",
            cell: ({ row }) => (
              <AiActionLabel
                actionKey={row.actionKey}
                className="max-w-xs"
                title={titles.get(row.actionKey)}
              />
            ),
            header: t("list.action"),
          },
          {
            accessorKey: "status",
            cell: ({ row }) => <AiRunStatusBadge status={row.status} />,
            header: t("list.status"),
          },
          {
            accessorKey: "actorType",
            cell: ({ row }) =>
              row.user ? (
                <span className="truncate">{row.user.name}</span>
              ) : (
                <span className="text-muted-foreground">
                  {tOrigin(row.actorType)}
                </span>
              ),
            header: t("list.actor"),
          },
          {
            accessorKey: "modelId",
            cell: ({ row }) =>
              row.modelId ? (
                (modelNames.get(row.modelId) ?? (
                  <span className="font-mono text-xs">{row.modelId}</span>
                ))
              ) : (
                <span className="text-muted-foreground">—</span>
              ),
            header: t("list.model"),
          },
          {
            accessorKey: "costUsd",
            align: "right",
            cell: ({ row }) => <AiRunCost row={row} />,
            header: t("list.cost"),
          },
          {
            accessorKey: "chargedPoints",
            align: "right",
            cell: ({ row }) =>
              row.chargedPoints === null ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                <span className="tabular-nums">
                  {formatAiPoints(row.chargedPoints, locale)}
                </span>
              ),
            header: t("list.points"),
          },
          {
            accessorKey: "createdAt",
            cell: ({ row }) => <DateFormat date={row.createdAt} />,
            header: t("list.created"),
          },
          {
            align: "right",
            cell: ({ row }) => (
              <Button
                onClick={() => {
                  setOpenRun(row);
                }}
                size="sm"
                variant="ghost"
              >
                {t("list.details")}
              </Button>
            ),
            header: <span className="sr-only">{t("list.details")}</span>,
            id: "details",
          },
        ]}
        customNoResults={{
          description: t("empty.desc"),
          icon: <HistoryIcon />,
          title: t("empty.title"),
        }}
        edges={data.edges}
        header={
          <AiHistoryFiltersContent
            actions={translatedActions}
            filters={filters}
            models={models}
            onFilterChange={onFilterChange}
          />
        }
        id="ai-history-table"
        order={{
          columns: ["createdAt"],
          defaultOrder: { column: "createdAt", order: "desc" },
        }}
        pageInfo={data.pageInfo}
      />

      <Dialog
        onOpenChange={open => {
          if (!open) setOpenRun(null);
        }}
        open={openRun !== null}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {t("detail.title", { id: openRun?.id ?? 0 })}
            </DialogTitle>
            <DialogDescription className="font-mono text-xs">
              {openRun?.actionKey}
            </DialogDescription>
          </DialogHeader>
          {openRun ? (
            <React.Suspense
              fallback={
                <div className="flex items-center justify-center p-6">
                  <Spinner size="xl" />
                </div>
              }
            >
              <AiRunDetailContent id={openRun.id} runQuery={runQuery} />
            </React.Suspense>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
};
