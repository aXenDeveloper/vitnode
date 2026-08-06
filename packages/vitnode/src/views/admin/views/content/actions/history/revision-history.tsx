// No "use client": reached only from `history-action`, which is a client entry.
import { HistoryIcon, RotateCcwIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import React from "react";
import { toast } from "sonner";

import type { ContentFormSpec } from "@/content/admin/spec";
import type {
  ContentRevisionDetail,
  ContentRevisionMeta,
  ContentRevisionOperation,
} from "@/content/revisions";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { DateFormat } from "@/components/date-format";
import { useAdminStaffPermission } from "@/components/staff-permission/provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { CONTENT_PERMISSIONS } from "@/content/const";
import { usePathname, useRouter } from "@/lib/navigation";

import { contentErrorKey } from "../../lib/mutation-feedback";
import {
  getContentRevisionAction,
  listContentRevisionsAction,
  restoreContentRevisionAction,
} from "../mutation-api.server";
import { RevisionDiff } from "./revision-diff";

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

/** `create` reads better as "Created" than as a raw operation name. */
const OperationBadge = ({
  operation,
}: {
  operation: ContentRevisionOperation;
}) => {
  const t = useTranslations("core.content.history.operations");

  return (
    <Badge variant={operation === "delete" ? "destructive" : "secondary"}>
      {t(operation)}
    </Badge>
  );
};

/**
 * One expandable row: metadata always, the snapshot only once opened.
 *
 * Loading every snapshot up front would mean shipping every historical version
 * of a long article to the browser to render a list of dates.
 */
const RevisionRow = ({
  canRestore,
  contentTypeId,
  currentVersion,
  id,
  isCurrent,
  onRestored,
  previousId,
  revision,
  singular,
  spec,
  title,
}: {
  canRestore: boolean;
  contentTypeId: string;
  currentVersion: number;
  id: number;
  isCurrent: boolean;
  onRestored: (nextVersion?: number) => void;
  previousId: null | number;
  revision: ContentRevisionMeta;
  singular: string;
  spec: ContentFormSpec;
  title: string;
}) => {
  const t = useTranslations("core.content.history");
  const tErrors = useTranslations("core.global.errors");
  const tContentErrors = useTranslations("core.content.errors");
  const [detail, setDetail] = React.useState<ContentRevisionDetail | null>(
    null,
  );
  const [previous, setPrevious] = React.useState<ContentRevisionDetail | null>(
    null,
  );
  // Whether a fetch has come back at all, which is the only way to tell "still
  // loading" from "loaded, and there was nothing there". Derived rather than a
  // `loading` flag so nothing sets state synchronously inside the effect.
  const [settled, setSettled] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  // Fetches whichever snapshots are missing, and only those.
  //
  // An effect rather than a click handler because the pair this row needs can
  // change while it is open: the last row of a page has nothing below it, so
  // its diff opens with no "before" - and **Load older versions** then puts one
  // there. Loading on click alone would leave that row comparing against
  // nothing until it was closed and reopened.
  React.useEffect(() => {
    if (!open) return;

    const needsDetail = detail === null;
    // Not "is it null" but "is it the right one": the boundary row's previous
    // arrives one page late, and re-fetching a snapshot already on screen is
    // wasted work.
    const needsPrevious = previousId !== null && previous?.id !== previousId;
    if (!needsDetail && !needsPrevious) return;

    let active = true;

    void Promise.all([
      needsDetail
        ? getContentRevisionAction(contentTypeId, id, revision.id)
        : null,
      needsPrevious
        ? getContentRevisionAction(contentTypeId, id, previousId)
        : null,
    ]).then(([current, earlier]) => {
      if (!active) return;

      // Both in one batch, so the diff never renders for a frame with its
      // "before" still missing and every field looking newly added.
      if (current) setDetail(current.revision ?? null);
      if (earlier) setPrevious(earlier.revision ?? null);
      setSettled(true);
    });

    return () => {
      active = false;
    };
  }, [contentTypeId, detail, id, open, previous?.id, previousId, revision.id]);

  return (
    <li className="flex flex-col gap-2 border-b py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium tabular-nums">v{revision.version}</span>
        <OperationBadge operation={revision.operation} />
        {isCurrent ? <Badge>{t("current")}</Badge> : null}

        <span className="text-muted-foreground text-sm">
          {revision.actorName ?? t("system_actor")}
        </span>
        <span className="text-muted-foreground text-sm">
          <DateFormat date={revision.createdAt} />
        </span>

        <div className="ms-auto flex items-center gap-2">
          <Button
            aria-expanded={open}
            onClick={() => {
              setOpen(!open);
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            {open ? t("hide_changes") : t("show_changes")}
          </Button>

          {canRestore && !isCurrent ? (
            <ConfirmActionAlertDialog
              description={t.rich("restore.desc", {
                nextVersion: currentVersion + 1,
                title: () => (
                  <span className="text-foreground font-bold">{title}</span>
                ),
                version: revision.version,
              })}
              onSubmit={async ({ onClose }) => {
                const mutation = await restoreContentRevisionAction(
                  contentTypeId,
                  id,
                  revision.id,
                  currentVersion,
                );

                if (mutation.error !== undefined) {
                  const errorKey = contentErrorKey(mutation.status, mutation);

                  toast.error(tErrors("title"), {
                    description: errorKey
                      ? tContentErrors(errorKey)
                      : tErrors("internal_server_error"),
                  });

                  // Left open, so the reason stays next to the thing that
                  // failed - the same behaviour as delete and publish.
                  return;
                }

                toast.success(t("restore.success", { name: singular }), {
                  description: t("restore.success_desc", {
                    version: revision.version,
                  }),
                });
                onClose();
                // The new version travels back so the next restore in this
                // still-open dialog posts the right precondition.
                onRestored(mutation.version);
              }}
              textSubmit={t("restore.confirm")}
              title={t("restore.title", { version: revision.version })}
            >
              <Button
                aria-label={t("restore.title", { version: revision.version })}
                size="sm"
                type="button"
                variant="outline"
              >
                <RotateCcwIcon aria-hidden className="size-4" />
                {t("restore.action")}
              </Button>
            </ConfirmActionAlertDialog>
          ) : null}
        </div>
      </div>

      {revision.changedFields.length > 0 ? (
        <p className="text-muted-foreground text-sm">
          {t("changed_fields", {
            fields: revision.changedFields.join(", "),
          })}
        </p>
      ) : null}

      {open ? (
        // Keyed on the snapshot rather than on a loading flag, so a later fetch
        // of the missing "before" refines the diff in place instead of
        // replacing it with a spinner somebody has to wait out again.
        detail ? (
          <RevisionDiff
            after={detail.snapshot}
            before={previous?.snapshot ?? null}
            spec={spec}
          />
        ) : settled ? (
          <p className="text-muted-foreground text-sm">{t("load_failed")}</p>
        ) : (
          <Loader />
        )
      ) : null}
    </li>
  );
};

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

  if (!state.loaded) return <Loader />;

  if (state.edges.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <HistoryIcon aria-hidden className="text-muted-foreground size-8" />
        <p className="text-muted-foreground text-sm text-balance">
          {state.error ?? t("empty")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
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
          disabled={loadingMore}
          onClick={() => {
            void loadMore();
          }}
          type="button"
          variant="outline"
        >
          {loadingMore ? t("loading_more") : t("load_more")}
        </Button>
      ) : null}
    </div>
  );
};
