import type { UseQueryResult } from "@tanstack/react-query";

import { PlugIcon, RotateCwIcon, UnplugIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

import type { McpConnection } from "./connected-apps-query";
import type { DisconnectConnectedApp } from "./connection-item";

import { SettingsGroup } from "../settings-group";
import { ConnectedAppsSkeleton } from "./connected-apps-skeleton";
import { ConnectionItem } from "./connection-item";

const endpointCode = (chunks: React.ReactNode) => (
  <code className="bg-muted text-foreground rounded px-1 py-0.5 font-mono text-sm break-all sm:break-normal sm:whitespace-nowrap">
    {chunks}
  </code>
);

const RetryButton = ({ query }: { query: UseQueryResult<McpConnection[]> }) => {
  const t = useTranslations("core.auth.settings.connected_apps");

  return (
    <Button
      isLoading={query.isFetching}
      onClick={() => void query.refetch()}
      variant="outline"
    >
      <RotateCwIcon aria-hidden="true" />
      {t("retry")}
    </Button>
  );
};

export const ConnectedAppsContent = ({
  endpoint,
  onDisconnect,
  query,
}: {
  /** The MCP endpoint clients connect to, e.g. `https://site/api/mcp`. */
  endpoint: string;
  onDisconnect: DisconnectConnectedApp;
  query: UseQueryResult<McpConnection[]>;
}) => {
  const t = useTranslations("core.auth.settings.connected_apps");
  const tGlobal = useTranslations("core.global");
  const endpointValues = { code: endpointCode, url: endpoint };

  if (query.isPending) {
    return (
      <div aria-busy="true">
        <span className="sr-only" role="status">
          {tGlobal("loading")}
        </span>
        <ConnectedAppsSkeleton />
      </div>
    );
  }

  if (query.isError && query.data === undefined) {
    return (
      <Empty className="border" role="alert">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <UnplugIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{t("load_error.title")}</EmptyTitle>
          <EmptyDescription>{t("load_error.desc")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <RetryButton query={query} />
        </EmptyContent>
      </Empty>
    );
  }

  const connections = query.data ?? [];

  return (
    <div
      aria-busy={query.isFetching}
      className="flex flex-col gap-4 aria-busy:opacity-60 motion-safe:transition-opacity"
    >
      {query.isError ? (
        <Alert variant="warning">
          <AlertTitle>{t("refetch_error.title")}</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            {t("refetch_error.desc")}
            <RetryButton query={query} />
          </AlertDescription>
        </Alert>
      ) : null}

      {connections.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PlugIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{t("empty.title")}</EmptyTitle>
            <EmptyDescription className="leading-relaxed">
              {t.rich("empty.desc", endpointValues)}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <SettingsGroup>
            {connections.map(connection => (
              <ConnectionItem
                connection={connection}
                key={connection.id}
                onDisconnect={onDisconnect}
              />
            ))}
          </SettingsGroup>
          <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
            {t.rich("how_to", endpointValues)}
          </p>
        </>
      )}
    </div>
  );
};
