import { cn } from "cn";
import {
  CpuIcon,
  GaugeIcon,
  SettingsIcon,
  TriangleAlertIcon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { DataTableNavigation } from "@/components/table/navigation";

import { ContentDataTable } from "@/components/table/content";
import { DataTableNavigationProvider } from "@/components/table/navigation";
import {
  readTableFilter,
  readTablePage,
  readTablePageSize,
  readTableSearch,
  withTableSearch,
} from "@/components/table/url-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { TooltipWithContent } from "@/components/ui/tooltip";
import {
  type AiActionTranslate,
  withTranslatedAiActionText,
} from "@/lib/ai/action-text";

import type { AdminAiAction, AdminAiModel } from "../ai-query";
import type { AiActionFormProps } from "./action-form-content";

import { AiActionIcon } from "../ai-labels";

const AiActionFormContent = React.lazy(async () =>
  import("./action-form-content").then(module => ({
    default: module.AiActionFormContent,
  })),
);

export interface AiActionsContentProps {
  actions: AdminAiAction[];
  canManage: boolean;
  models: AdminAiModel[];
  onSave: AiActionFormProps["onSave"];
}

type ManageProps = Pick<AiActionsContentProps, "models" | "onSave">;

export const EditAiActionAction = ({
  action,
  models,
  onSave,
}: ManageProps & {
  action: AdminAiAction;
}) => {
  const t = useTranslations("admin.ai.actions.form");
  const [open, setOpen] = React.useState(false);

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <TooltipWithContent text={t("open")}>
        <SheetTrigger
          render={
            <Button
              aria-label={t("open_label", { title: action.title })}
              size="icon"
              variant="ghost"
            />
          }
        >
          <SettingsIcon />
        </SheetTrigger>
      </TooltipWithContent>
      <SheetContent className="w-full gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader className="border-b pe-14">
          <SheetTitle>{action.title}</SheetTitle>
          <SheetDescription className="leading-relaxed text-pretty">
            {action.description}
          </SheetDescription>
          <p className="text-muted-foreground font-mono text-xs break-all">
            {action.key}
          </p>
        </SheetHeader>
        <React.Suspense
          fallback={
            <div className="flex flex-1 items-center justify-center">
              <Spinner size="xl" />
            </div>
          }
        >
          <AiActionFormContent
            action={action}
            models={models}
            onSave={onSave}
            onSaved={() => {
              setOpen(false);
            }}
          />
        </React.Suspense>
      </SheetContent>
    </Sheet>
  );
};

const AiActionEnabledSwitch = ({
  action,
  onSave,
}: Pick<AiActionsContentProps, "onSave"> & { action: AdminAiAction }) => {
  const t = useTranslations("admin.ai.actions");
  const tError = useTranslations("core.global.errors");
  const [pending, setPending] = React.useState<boolean | null>(null);

  const onCheckedChange = async (enabled: boolean) => {
    setPending(enabled);
    const result = await onSave({
      ...action.settings,
      enabled,
      key: action.key,
    });
    setPending(null);

    if ("error" in result) {
      toast.error(tError("title"), {
        description: tError("internal_server_error"),
      });

      return;
    }

    toast.success(
      t(enabled ? "toggled.on" : "toggled.off", { title: action.title }),
      {
        description: t(enabled ? "toggled.on_desc" : "toggled.off_desc"),
      },
    );
  };

  return (
    <Switch
      aria-label={t("toggle_label", { title: action.title })}
      checked={pending ?? action.settings.enabled}
      disabled={pending !== null}
      onCheckedChange={onCheckedChange}
    />
  );
};

const AiActionMeta = ({
  action,
  models,
}: Pick<AiActionsContentProps, "models"> & { action: AdminAiAction }) => {
  const t = useTranslations("admin.ai.actions");
  const { modelId } = action.settings;
  const dailyLimit = action.settings.dailyLimit ?? action.defaults.dailyLimit;
  const canRun = action.compatibleModelIds.length > 0;

  if (canRun && modelId === null && dailyLimit === null) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {canRun ? null : (
        <Badge variant="destructive">
          <TriangleAlertIcon aria-hidden />
          {t("no_compatible")}
        </Badge>
      )}
      {modelId === null ? null : (
        <Badge variant="secondary">
          <CpuIcon aria-hidden />
          {models.find(model => model.id === modelId)?.name ?? modelId}
        </Badge>
      )}
      {dailyLimit === null ? null : (
        <Badge variant="secondary">
          <GaugeIcon aria-hidden />
          {t("daily_limit", { count: dailyLimit })}
        </Badge>
      )}
    </div>
  );
};

const AiActionRow = ({
  action,
  canManage,
  models,
  onSave,
}: Omit<AiActionsContentProps, "actions"> & { action: AdminAiAction }) => {
  const t = useTranslations("admin.ai.actions");
  const { enabled } = action.settings;

  return (
    <div className="flex items-start gap-3 sm:items-center">
      <AiActionIcon enabled={enabled} icon={action.icon} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "font-medium text-pretty transition-colors",
              enabled ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {action.title}
          </span>
          {enabled || canManage ? null : (
            <Badge variant="outline">{t("disabled")}</Badge>
          )}
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {action.description}
        </p>
        <AiActionMeta action={action} models={models} />
      </div>
      {canManage ? (
        <div className="flex shrink-0 items-center gap-2">
          <AiActionEnabledSwitch action={action} onSave={onSave} />
          <EditAiActionAction action={action} models={models} onSave={onSave} />
        </div>
      ) : null}
    </div>
  );
};

const PLUGIN_FILTER = "plugin";

type AiActionRowData = AdminAiAction & { id: number };

const matchesSearch = (action: AdminAiAction, search: string) => {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;

  return [action.title, action.description, action.key].some(value =>
    value.toLowerCase().includes(needle),
  );
};

export const AiActionsContent = ({
  actions,
  canManage,
  models,
  onSave,
}: AiActionsContentProps) => {
  const t = useTranslations("admin.ai.actions");
  const tAll = useTranslations() as unknown as AiActionTranslate;
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
  const rows: AiActionRowData[] = actions
    .map(action => withTranslatedAiActionText(tAll, action))
    .toSorted(
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
  const pageSize = readTablePageSize(searchParams);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(readTablePage(searchParams), totalPages);
  const pageRows = rows.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  return (
    <DataTableNavigationProvider value={navigation}>
      <ContentDataTable
        customNoResults={
          actions.length === 0
            ? { description: t("empty.desc"), title: t("empty.title") }
            : {
                description: t("no_results.desc"),
                footer: (
                  <Button
                    onClick={() => {
                      setSearchParams(
                        new URLSearchParams(withTableSearch(searchParams, "")),
                      );
                    }}
                    variant="outline"
                  >
                    {t("no_results.clear")}
                  </Button>
                ),
                title: t("no_results.title"),
              }
        }
        edges={pageRows}
        filters={
          plugins.length > 1
            ? [
                {
                  id: PLUGIN_FILTER,
                  label: t("plugin"),
                  options: plugins.map(plugin => ({
                    label: plugin,
                    value: plugin,
                  })),
                },
              ]
            : undefined
        }
        groupBy={{
          key: row => row.pluginId,
          label: group => <span className="font-mono">{group.key}</span>,
        }}
        id="ai-actions"
        order={{ defaultOrder: { column: "title", order: "asc" } }}
        pageInfo={{
          count: pageRows.length,
          currentPage,
          endCursor: null,
          hasNextPage: currentPage < totalPages,
          hasPreviousPage: currentPage > 1,
          pageSize,
          startCursor: null,
          totalCount: rows.length,
          totalPages,
        }}
        renderRow={({ row }) => (
          <AiActionRow
            action={row}
            canManage={canManage}
            models={models}
            onSave={onSave}
          />
        )}
        search
        searchPlaceholder={t("search")}
      />
    </DataTableNavigationProvider>
  );
};
