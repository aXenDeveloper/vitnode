import { PencilIcon, SparklesIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import type { ColumnDef } from "@/components/table/data-table-content";
import type { DataTableNavigation } from "@/components/table/navigation";

import { ContentDataTable } from "@/components/table/content";
import { DataTableNavigationProvider } from "@/components/table/navigation";
import { readTableFilter, readTableSearch } from "@/components/table/url-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DynamicIcon } from "@/components/ui/dynamic-icon";
import { Spinner } from "@/components/ui/spinner";
import { TooltipWithContent } from "@/components/ui/tooltip";

import type { AdminAiAction, AdminAiModel } from "../ai-query";
import type { AiActionFormProps } from "./action-form-content";

const AiActionFormContent = React.lazy(async () =>
  import("./action-form-content").then(module => ({
    default: module.AiActionFormContent,
  })),
);

const PLUGIN_FILTER = "plugin";

export interface AiActionsContentProps {
  actions: AdminAiAction[];
  canManage: boolean;
  models: AdminAiModel[];
  onSave: AiActionFormProps["onSave"];
}

type AiActionRow = AdminAiAction & { id: number };

export const EditAiActionAction = ({
  action,
  models,
  onSave,
}: Pick<AiActionsContentProps, "models" | "onSave"> & {
  action: AdminAiAction;
}) => {
  const t = useTranslations("admin.ai.actions.form");

  return (
    <Dialog>
      <TooltipWithContent text={t("open")}>
        <DialogTrigger
          render={
            <Button
              aria-label={t("open_label", { title: action.title })}
              size="icon"
              variant="ghost"
            />
          }
        >
          <PencilIcon />
        </DialogTrigger>
      </TooltipWithContent>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{action.title}</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {action.key}
          </DialogDescription>
        </DialogHeader>
        <React.Suspense
          fallback={
            <div className="flex items-center justify-center">
              <Spinner size="xl" />
            </div>
          }
        >
          <AiActionFormContent
            action={action}
            models={models}
            onSave={onSave}
          />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
};

const AiActionIcon = ({ icon }: { icon: null | string }) => (
  <span
    aria-hidden
    className="bg-muted text-foreground flex size-9 shrink-0 items-center justify-center rounded-lg"
  >
    {icon ? (
      <DynamicIcon
        className="size-4"
        fallback={<SparklesIcon className="size-4" />}
        name={icon}
      />
    ) : (
      <SparklesIcon className="size-4" />
    )}
  </span>
);

/** Matches the title, the description and the key, ignoring case. */
const matchesSearch = (action: AdminAiAction, search: string) => {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;

  return [action.title, action.description, action.key].some(value =>
    value.toLowerCase().includes(needle),
  );
};

/**
 * Every registered action in one table. The list is small and arrives whole,
 * so search and the plugin filter run in the browser.
 */
export const AiActionsContent = ({
  actions,
  canManage,
  models,
  onSave,
}: AiActionsContentProps) => {
  const t = useTranslations("admin.ai.actions");
  const [searchParams, setSearchParams] = React.useState(
    () => new URLSearchParams(),
  );
  const navigation = React.useMemo<DataTableNavigation>(
    () => ({
      navigate: nextSearch => {
        setSearchParams(new URLSearchParams(nextSearch));
      },
      searchParams,
    }),
    [searchParams],
  );

  const plugins = [...new Set(actions.map(action => action.pluginId))].sort(
    (a, b) => a.localeCompare(b),
  );
  const search = readTableSearch(searchParams);
  const selectedPlugins = readTableFilter(searchParams, PLUGIN_FILTER);
  const rows: AiActionRow[] = [...actions]
    .sort(
      (a, b) =>
        a.pluginId.localeCompare(b.pluginId) || a.title.localeCompare(b.title),
    )
    .map((action, index) => ({ ...action, id: index + 1 }))
    .filter(
      action =>
        matchesSearch(action, search) &&
        (selectedPlugins.length === 0 ||
          selectedPlugins.includes(action.pluginId)),
    );

  const modelName = (id: null | string) =>
    id === null
      ? t("model_default")
      : (models.find(model => model.id === id)?.name ?? id);

  const columns: ColumnDef<AiActionRow>[] = [
    {
      id: "title",
      header: t("columns.action"),
      cell: ({ row }) => (
        <div className="flex min-w-64 items-center gap-3">
          <AiActionIcon icon={row.icon} />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-foreground font-medium text-pretty">
              {row.title}
            </span>
            <span className="text-muted-foreground text-sm leading-relaxed text-pretty">
              {row.description}
            </span>
          </div>
        </div>
      ),
    },
    {
      id: "plugin",
      header: t("columns.plugin"),
      cell: ({ row }) => (
        <Badge className="font-mono" variant="outline">
          {row.pluginId}
        </Badge>
      ),
    },
    {
      id: "model",
      header: t("columns.model"),
      cell: ({ row }) =>
        row.compatibleModelIds.length === 0 ? (
          <span className="text-destructive">{t("no_compatible")}</span>
        ) : (
          modelName(row.settings.modelId)
        ),
    },
    {
      id: "dailyLimit",
      header: t("columns.daily_limit"),
      cell: ({ row }) => (
        <span className="tabular-nums">
          {row.settings.dailyLimit ?? row.defaults.dailyLimit ?? t("no_limit")}
        </span>
      ),
    },
    {
      id: "status",
      header: t("columns.status"),
      cell: ({ row }) => (
        <Badge variant={row.settings.enabled ? "success" : "outline"}>
          {row.settings.enabled ? t("enabled") : t("disabled")}
        </Badge>
      ),
    },
    ...(canManage
      ? [
          {
            id: "actions",
            header: <span className="sr-only">{t("columns.manage")}</span>,
            align: "right" as const,
            cell: ({ row }: { row: AiActionRow }) => (
              <EditAiActionAction
                action={row}
                models={models}
                onSave={onSave}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <DataTableNavigationProvider value={navigation}>
      <ContentDataTable
        columns={columns}
        customNoResults={
          actions.length === 0
            ? {
                description: t("empty.desc"),
                title: t("empty.title"),
              }
            : undefined
        }
        edges={rows}
        filters={
          plugins.length > 1
            ? [
                {
                  id: PLUGIN_FILTER,
                  label: t("columns.plugin"),
                  options: plugins.map(plugin => ({
                    label: plugin,
                    value: plugin,
                  })),
                },
              ]
            : undefined
        }
        id="ai-actions"
        order={{ defaultOrder: { column: "title", order: "asc" } }}
        pageInfo={{
          count: rows.length,
          currentPage: 1,
          endCursor: null,
          hasNextPage: false,
          hasPreviousPage: false,
          pageSize: Math.max(rows.length, 1),
          startCursor: null,
          totalCount: rows.length,
          totalPages: 1,
        }}
        search
        searchPlaceholder={t("search")}
      />
    </DataTableNavigationProvider>
  );
};
