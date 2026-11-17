import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRoundIcon, RotateCwIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { PageTitle } from "@/components/ui/page-title";
import { CardsPendingSkeleton } from "@/tanstack/pending";

import { McpContent } from "./mcp-content";
import { mcpSettingsQueryKey, mcpSettingsQueryOptions } from "./mcp-query";

const McpHeading = () => {
  const t = useTranslations("core.auth.settings.mcp");
  const tSettings = useTranslations("core.auth.settings");

  return (
    <PageTitle
      className="mb-0"
      desc={t("desc")}
      h1={t("title")}
      subtitle={tSettings("title")}
    />
  );
};

/** The AI integrations settings panel: the MCP endpoint and the member's tokens. */
export const McpPanelContent = ({ userId }: { userId: number }) => {
  const t = useTranslations("core.auth.settings.mcp");
  const queryClient = useQueryClient();
  const query = useQuery(mcpSettingsQueryOptions({ userId }));

  return (
    <>
      <McpHeading />
      {query.isPending ? (
        <CardsPendingSkeleton />
      ) : query.isError ? (
        <Empty className="border" role="alert">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <KeyRoundIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{t("load_error.title")}</EmptyTitle>
            <EmptyDescription>{t("load_error.desc")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              isLoading={query.isFetching}
              onClick={() => void query.refetch()}
              variant="outline"
            >
              <RotateCwIcon aria-hidden="true" />
              {t("retry")}
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <McpContent
          onChanged={async () => {
            await queryClient.invalidateQueries({
              queryKey: mcpSettingsQueryKey(userId),
            });
          }}
          settings={query.data}
        />
      )}
    </>
  );
};
