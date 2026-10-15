import { TriangleAlertIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import type { DataTableNavigation } from "@/components/table/navigation";

import { ContentDataTable } from "@/components/table/content";
import { DataTableNavigationProvider } from "@/components/table/navigation";
import {
  readTablePage,
  readTablePageSize,
  readTableSearch,
  withTableSearch,
} from "@/components/table/url-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type {
  AdminInstalledPlugin,
  AdminInstalledPlugins,
} from "./plugins-query";

import { PluginIcon } from "./plugin-icon";
import { matchesPluginSearch } from "./plugin-search";

export interface PluginsContentProps {
  data: AdminInstalledPlugins;
}

const PluginVersion = ({ version }: { version: null | string }) => {
  const t = useTranslations("admin.system.plugins");

  if (version === null) {
    return <Badge variant="outline">{t("version_unknown")}</Badge>;
  }

  return (
    <Badge className="font-mono" variant="secondary">
      {version}
    </Badge>
  );
};

const PluginRow = ({ plugin }: { plugin: AdminInstalledPlugin }) => {
  const t = useTranslations("admin.system.plugins");
  const { api, frontend } = plugin.registrations;

  return (
    <div className="flex items-start gap-3">
      <PluginIcon icon={plugin.icon} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium text-pretty">{plugin.title}</span>
          <PluginVersion version={plugin.version} />
        </div>
        {plugin.title === plugin.id ? null : (
          <span className="text-muted-foreground font-mono text-xs break-all">
            {plugin.id}
          </span>
        )}
        {plugin.description === null ? (
          <p className="text-muted-foreground text-sm leading-relaxed italic">
            {t("no_description")}
          </p>
        ) : (
          <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
            {plugin.description}
          </p>
        )}
        {plugin.versionMismatch && api?.version && frontend?.version ? (
          <p className="text-warn flex items-start gap-1.5 text-sm leading-relaxed text-pretty">
            <TriangleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
            {t("mismatch", { api: api.version, frontend: frontend.version })}
          </p>
        ) : null}
      </div>
    </div>
  );
};

const PluginsSummary = ({ core, count }: { core: string; count: number }) => {
  const t = useTranslations("admin.system.plugins");

  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="bg-card text-card-foreground ring-foreground/10 flex flex-col gap-1 rounded-xl px-4 py-3 shadow-xs ring-1">
        <dt className="text-muted-foreground text-sm">{t("core")}</dt>
        <dd className="font-mono text-lg font-semibold">{core}</dd>
      </div>
      <div className="bg-card text-card-foreground ring-foreground/10 flex flex-col gap-1 rounded-xl px-4 py-3 shadow-xs ring-1">
        <dt className="text-muted-foreground text-sm">{t("count_label")}</dt>
        <dd className="text-lg font-semibold tabular-nums">{count}</dd>
      </div>
    </dl>
  );
};

export const PluginsContent = ({ data }: PluginsContentProps) => {
  const t = useTranslations("admin.system.plugins");
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

  const search = readTableSearch(searchParams);
  const rows = data.plugins.filter(plugin =>
    matchesPluginSearch(plugin, search),
  );
  const pageSize = readTablePageSize(searchParams);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(readTablePage(searchParams), totalPages);
  const pageRows = rows.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  return (
    <div className="flex flex-col gap-4">
      <PluginsSummary core={data.core.version} count={data.plugins.length} />

      {data.frontendInventory ? null : (
        <Alert variant="info">
          <AlertTitle>{t("frontend_unknown.title")}</AlertTitle>
          <AlertDescription>{t("frontend_unknown.desc")}</AlertDescription>
        </Alert>
      )}

      <DataTableNavigationProvider value={navigation}>
        <ContentDataTable
          customNoResults={
            data.plugins.length === 0
              ? { description: t("empty.desc"), title: t("empty.title") }
              : {
                  description: t("no_results.desc"),
                  footer: (
                    <Button
                      onClick={() => {
                        setSearchParams(
                          new URLSearchParams(
                            withTableSearch(searchParams, ""),
                          ),
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
          id="installed-plugins"
          order={{ defaultOrder: { column: "id", order: "asc" } }}
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
          renderRow={({ row }) => <PluginRow plugin={row} />}
          search
          searchPlaceholder={t("search")}
        />
      </DataTableNavigationProvider>
    </div>
  );
};
