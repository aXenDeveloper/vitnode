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
import { Button } from "@/components/ui/button";

import type { VersionSides } from "./plugin-update-status";
import type {
  AdminComponentUpdate,
  AdminPluginUpdates,
} from "./plugin-updates-query";
import type {
  AdminInstalledPlugin,
  AdminInstalledPlugins,
} from "./plugins-query";

import { PluginIcon } from "./plugin-icon";
import { matchesPluginSearch } from "./plugin-search";
import { PluginUpdateStatus, SecurityUpdates } from "./plugin-update-status";

export interface PluginsContentProps {
  data: AdminInstalledPlugins;
  /** Stored update results. Left out, the catalog lists versions only. */
  updates?: AdminPluginUpdates;
}

/** Only worth naming the side when the API and the web app run different versions. */
const versionSidesOf = (plugin: AdminInstalledPlugin): VersionSides => {
  if (!plugin.versionMismatch) return {};

  const sides: VersionSides = {};
  const { api, frontend } = plugin.registrations;
  if (api?.version) sides[api.version] = [...(sides[api.version] ?? []), "api"];
  if (frontend?.version) {
    sides[frontend.version] = [...(sides[frontend.version] ?? []), "frontend"];
  }

  return sides;
};

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

const PluginCell = ({
  coreVersion,
  enabled,
  plugin,
  update,
}: {
  coreVersion: string;
  enabled: boolean;
  plugin: AdminInstalledPlugin;
  update: AdminComponentUpdate | undefined;
}) => {
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
        <SecurityUpdates sides={versionSidesOf(plugin)} update={update} />
        {/* Narrow screens: the version column has no room for this. */}
        <div className="md:hidden">
          <PluginUpdateStatus
            coreVersion={coreVersion}
            enabled={enabled}
            update={update}
          />
        </div>
      </div>
    </div>
  );
};

export const PluginsContent = ({ data, updates }: PluginsContentProps) => {
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
  const updateById = new Map(
    (updates?.plugins ?? []).map(update => [update.id, update]),
  );

  return (
    <DataTableNavigationProvider value={navigation}>
      {data.frontendInventory ? null : (
        <Alert className="mb-4" variant="info">
          <AlertTitle>{t("inventory_missing.title")}</AlertTitle>
          <AlertDescription className="leading-relaxed text-pretty">
            {t("inventory_missing.desc")}
          </AlertDescription>
        </Alert>
      )}
      <ContentDataTable
        columns={[
          {
            id: "plugin",
            header: t("list.plugin"),
            className: "w-full whitespace-normal",
            cell: ({ row }) => (
              <PluginCell
                coreVersion={data.core.version}
                enabled={updates?.enabled ?? true}
                plugin={row}
                update={updateById.get(row.id)}
              />
            ),
          },
          {
            id: "version",
            header: t("list.version"),
            className: "whitespace-normal md:min-w-64",
            cell: ({ row }) => (
              <div className="flex flex-col gap-1">
                <PluginVersion version={row.version} />
                <div className="hidden md:block">
                  <PluginUpdateStatus
                    coreVersion={data.core.version}
                    enabled={updates?.enabled ?? true}
                    update={updateById.get(row.id)}
                  />
                </div>
              </div>
            ),
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
