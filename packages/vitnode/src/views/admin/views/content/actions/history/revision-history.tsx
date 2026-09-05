// No "use client": reached only from `history-action`, which is a client entry.
import { useInfiniteQuery } from "@tanstack/react-query";
import { HistoryIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import type { ContentFormSpec } from "@/content/admin/spec";

import { useAdminStaffPermission } from "@/components/staff-permission/provider";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { CONTENT_PERMISSIONS } from "@/content/const";

import { useContentFormNavigation } from "../../form/navigation";
import {
  contentRevisionHistoryQueryOptions,
  flattenContentRevisionPages,
} from "../editorial-query";
import { useContentEditorialTransport } from "../editorial-transport";
import { RevisionRow } from "./revision-row";

interface RevisionHistoryProps {
  contentTypeId: string;
  currentVersion: number;
  id: number;
  permissionModule: string;
  pluginId: string;
  singular: string;
  spec: ContentFormSpec;
  title: string;
}

const HistoryNotice = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-col items-center gap-3 py-10 text-center">
    {children}
  </div>
);

export const RevisionHistory = ({
  contentTypeId,
  currentVersion,
  id,
  permissionModule,
  pluginId,
  singular,
  spec,
  title,
}: RevisionHistoryProps) => {
  const t = useTranslations("core.content.history");
  const transport = useContentEditorialTransport();
  const { refresh } = useContentFormNavigation();
  const canRestore = useAdminStaffPermission({
    module: permissionModule,
    permission: CONTENT_PERMISSIONS.restore,
    plugin: pluginId,
  });

  const history = useInfiniteQuery(
    contentRevisionHistoryQueryOptions({
      contentTypeId,
      itemId: id,
      listRevisions: transport.listRevisions,
    }),
  );

  if (history.isPending) {
    return (
      <HistoryNotice>
        <Loader />
      </HistoryNotice>
    );
  }

  const pages = history.data?.pages ?? [];
  const edges = flattenContentRevisionPages(pages);

  const version = Math.max(currentVersion, edges[0]?.version ?? 0);
  // A read that failed answers with an empty page and a sentence rather than by
  // rejecting, so an unreachable API reads as "we could not load this" instead
  // of as a record with no history - which is what a brand-new record looks like.
  const error = pages.find(page => page.error !== undefined)?.error ?? null;

  if (edges.length === 0) {
    return (
      <HistoryNotice>
        <span className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-full">
          <HistoryIcon aria-hidden className="size-5" />
        </span>
        <p className="text-muted-foreground max-w-xs text-sm text-balance">
          {error !== null && error !== "" ? error : t("empty")}
        </p>
      </HistoryNotice>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col">
        {edges.map((revision, index) => (
          <RevisionRow
            canRestore={canRestore}
            contentTypeId={contentTypeId}
            currentVersion={version}
            id={id}
            isCurrent={index === 0}
            key={revision.id}
            onRestored={() => {
              // The timeline itself has already been invalidated by the
              // transport's `settled`; this is the rest of the screen - the row
              // behind the dialog, the page heading - which lives outside React
              // Query and is each host's own to bring back in step.
              refresh();
            }}
            previousId={edges[index + 1]?.id ?? null}
            revision={revision}
            singular={singular}
            spec={spec}
            title={title}
          />
        ))}
      </ul>

      {error !== null && error !== "" ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : null}

      {history.hasNextPage ? (
        <Button
          className="self-center"
          isLoading={history.isFetchingNextPage}
          onClick={() => {
            void history.fetchNextPage();
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          {t("load_more")}
        </Button>
      ) : null}
    </div>
  );
};
