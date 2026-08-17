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
  /** The record's current version, for the restore precondition. */
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

/** The same centred block for "still loading", "nothing here" and "it broke". */
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
  // The version the record holds *now*, which stops being the prop the moment
  // a restore succeeds - the dialog stays open, and the next restore needs the
  // new precondition or it conflicts with the one just performed.
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

  /** Appends the next page. The cursor is exclusive, so nothing repeats. */
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

      // Belt and braces against a revision arriving between two page requests:
      // the exclusive cursor already prevents a repeat, and this makes the list
      // provably duplicate-free whatever the server sent.
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

  /** Reloads the first page, so the restore's own revision shows up. */
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

    // The table behind the dialog is now wrong too.
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
            // The list is newest first, so the previous version is the next
            // entry - except at the end of a page that has more behind it,
            // where the diff has nothing to compare against yet.
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
