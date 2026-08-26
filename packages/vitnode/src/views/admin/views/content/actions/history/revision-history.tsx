// No "use client": reached only from `history-action`, which is a client entry.
import { HistoryIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import React from "react";

import type { ContentFormSpec } from "@/content/admin/spec";
import type { ContentRevisionMeta } from "@/content/revisions";

import { useAdminStaffPermission } from "@/components/staff-permission/provider";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { CONTENT_PERMISSIONS } from "@/content/const";
import { usePathname, useRouter } from "@/lib/navigation";

import { listContentRevisionsAction } from "../mutation-api.server";
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

interface HistoryState {
  edges: ContentRevisionMeta[];
  endCursor: null | number;
  error: null | string;
  hasNextPage: boolean;
  loaded: boolean;
}

const EMPTY: HistoryState = {
  edges: [],
  endCursor: null,
  error: null,
  hasNextPage: false,
  loaded: false,
};

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
  const { push } = useRouter();
  const pathname = usePathname();
  const [state, setState] = React.useState<HistoryState>(EMPTY);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [version, setVersion] = React.useState(currentVersion);
  const canRestore = useAdminStaffPermission({
    module: permissionModule,
    permission: CONTENT_PERMISSIONS.restore,
    plugin: pluginId,
  });

  React.useEffect(() => {
    let active = true;

    void listContentRevisionsAction(contentTypeId, id).then(result => {
      if (!active) return;

      setState({
        edges: result.edges,
        endCursor: result.pageInfo.endCursor,
        error: result.error ?? null,
        hasNextPage: result.pageInfo.hasNextPage,
        loaded: true,
      });
    });

    return () => {
      active = false;
    };
  }, [contentTypeId, id]);

  const loadMore = async () => {
    if (state.endCursor === null) return;
    setLoadingMore(true);

    const result = await listContentRevisionsAction(
      contentTypeId,
      id,
      state.endCursor,
    );

    setState(previous => {
      if (result.error) return { ...previous, error: result.error };

      const seen = new Set(previous.edges.map(edge => edge.id));

      return {
        ...previous,
        edges: [
          ...previous.edges,
          ...result.edges.filter(edge => !seen.has(edge.id)),
        ],
        endCursor: result.pageInfo.endCursor ?? previous.endCursor,
        error: null,
        hasNextPage: result.pageInfo.hasNextPage,
      };
    });
    setLoadingMore(false);
  };

  const reload = async (nextVersion?: number) => {
    if (nextVersion !== undefined) setVersion(nextVersion);

    const result = await listContentRevisionsAction(contentTypeId, id);

    setState({
      edges: result.edges,
      endCursor: result.pageInfo.endCursor,
      error: result.error ?? null,
      hasNextPage: result.pageInfo.hasNextPage,
      loaded: true,
    });

    push(pathname);
  };

  if (!state.loaded) {
    return (
      <HistoryNotice>
        <Loader />
      </HistoryNotice>
    );
  }

  if (state.edges.length === 0) {
    return (
      <HistoryNotice>
        <span className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-full">
          <HistoryIcon aria-hidden className="size-5" />
        </span>
        <p className="text-muted-foreground max-w-xs text-sm text-balance">
          {state.error ?? t("empty")}
        </p>
      </HistoryNotice>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col">
        {state.edges.map((revision, index) => (
          <RevisionRow
            canRestore={canRestore}
            contentTypeId={contentTypeId}
            currentVersion={version}
            id={id}
            isCurrent={index === 0}
            key={revision.id}
            onRestored={nextVersion => {
              void reload(nextVersion);
            }}
            previousId={state.edges[index + 1]?.id ?? null}
            revision={revision}
            singular={singular}
            spec={spec}
            title={title}
          />
        ))}
      </ul>

      {state.error ? (
        <p className="text-destructive text-sm">{state.error}</p>
      ) : null}

      {state.hasNextPage ? (
        <Button
          className="self-center"
          isLoading={loadingMore}
          onClick={() => {
            void loadMore();
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
