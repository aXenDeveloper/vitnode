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
  onRestored: () => void;
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
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  const load = async () => {
    if (detail) return;
    setLoading(true);

    const [current, earlier] = await Promise.all([
      getContentRevisionAction(contentTypeId, id, revision.id),
      previousId === null
        ? Promise.resolve({ revision: undefined })
        : getContentRevisionAction(contentTypeId, id, previousId),
    ]);

    setDetail(current.revision ?? null);
    setPrevious(earlier.revision ?? null);
    setLoading(false);
  };

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
              if (!open) void load();
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
                onRestored();
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
        loading ? (
          <Loader />
        ) : detail ? (
          <RevisionDiff
            after={detail.snapshot}
            before={previous?.snapshot ?? null}
            spec={spec}
          />
        ) : (
          <p className="text-muted-foreground text-sm">{t("load_failed")}</p>
        )
      ) : null}
    </li>
  );
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
  const [edges, setEdges] = React.useState<ContentRevisionMeta[] | null>(null);
  const canRestore = useAdminStaffPermission({
    module: permissionModule,
    permission: CONTENT_PERMISSIONS.restore,
    plugin: pluginId,
  });

  React.useEffect(() => {
    let active = true;

    void listContentRevisionsAction(contentTypeId, id).then(result => {
      if (active) setEdges(result.edges);
    });

    return () => {
      active = false;
    };
  }, [contentTypeId, id]);

  if (edges === null) return <Loader />;

  if (edges.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <HistoryIcon aria-hidden className="text-muted-foreground size-8" />
        <p className="text-muted-foreground text-sm text-balance">
          {t("empty")}
        </p>
      </div>
    );
  }

  return (
    <ul className="flex max-h-[60vh] flex-col overflow-y-auto">
      {edges.map((revision, index) => (
        <RevisionRow
          canRestore={canRestore}
          contentTypeId={contentTypeId}
          currentVersion={currentVersion}
          id={id}
          isCurrent={index === 0}
          key={revision.id}
          onRestored={() => {
            push(pathname);
          }}
          // The list is newest first, so the previous version is the next entry.
          previousId={edges[index + 1]?.id ?? null}
          revision={revision}
          singular={singular}
          spec={spec}
          title={title}
        />
      ))}
    </ul>
  );
};
