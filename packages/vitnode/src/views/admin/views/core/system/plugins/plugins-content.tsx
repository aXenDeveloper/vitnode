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
    return (
      <span className="text-muted-foreground text-sm">
        {t("version_unknown")}
      </span>
    );
  }

  return <span className="font-mono text-sm">{version}</span>;
};

const PluginCell = ({ plugin }: { plugin: AdminInstalledPlugin }) => {
  const t = useTranslations("admin.system.plugins");
  const { api, frontend } = plugin.registrations;

  return (
    <div className="flex items-start gap-3">
      <PluginIcon icon={plugin.icon} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-medium text-pretty">{plugin.title}</span>
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
    <DataTableNavigationProvider value={navigation}>
      <ContentDataTable
        columns={[
          {
            id: "plugin",
            header: t("list.plugin"),
            className: "w-full whitespace-normal",
            cell: ({ row }) => <PluginCell plugin={row} />,
          },
          {
            id: "version",
            header: t("list.version"),
            cell: ({ row }) => <PluginVersion version={row.version} />,
          },
        ]}
        customNoResults={
          data.plugins.length === 0
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
        search
        searchPlaceholder={t("search")}
      />
    </DataTableNavigationProvider>
  );
};
