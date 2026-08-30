// No "use client": reached only from `history-action`, which is a client entry.
import { useQuery } from "@tanstack/react-query";
import { ChevronDownIcon, RotateCcwIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { ContentFormSpec } from "@/content/admin/spec";
import type {
  ContentRevisionMeta,
  ContentRevisionOperation,
} from "@/content/revisions";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { DateFormat } from "@/components/date-format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { cn } from "@/lib/utils";

import { contentErrorKey } from "../../lib/mutation-feedback";
import { contentRevisionQueryOptions } from "../editorial-query";
import { useContentEditorialTransport } from "../editorial-transport";
import { RevisionActor } from "./revision-actor";
import { RevisionDiff } from "./revision-diff";

const OPERATION_TONES: Record<
  ContentRevisionOperation,
  { badge: string; dot: string }
> = {
  create: {
    badge:
      "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400",
    dot: "bg-green-500",
  },
  delete: {
    badge: "border-destructive/40 bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
  publish: {
    badge: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400",
    dot: "bg-blue-500",
  },
  restore: {
    badge:
      "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-400",
    dot: "bg-violet-500",
  },
  unpublish: {
    badge: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/40",
  },
  update: {
    badge:
      "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
  },
};

const OperationBadge = ({
  operation,
}: {
  operation: ContentRevisionOperation;
}) => {
  const t = useTranslations("core.content.history.operations");

  return (
    <Badge className={OPERATION_TONES[operation].badge} variant="outline">
      {t(operation)}
    </Badge>
  );
};

/**
 * One snapshot, read when a row is expanded and not before.
 *
 * `enabled` is the whole of the laziness: a 25-revision timeline is 25 of these
 * mounted, and none of them requests anything until somebody opens it. Cached
 * under `../editorial-query`'s per-revision key, so collapsing and reopening the
 * same row is free - a revision's snapshot is immutable, and the only thing that
 * can invalidate it is a restore, which expires the whole `history` root.
 */
const useRevisionSnapshot = ({
  contentTypeId,
  enabled,
  itemId,
  revisionId,
}: {
  contentTypeId: string;
  enabled: boolean;
  itemId: number;
  revisionId: null | number;
}) => {
  const transport = useContentEditorialTransport();

  return useQuery({
    ...contentRevisionQueryOptions({
      contentTypeId,
      getRevision: transport.getRevision,
      itemId,
      revisionId: revisionId ?? 0,
    }),
    // Whether this row has been expanded is the row's own state, so it stays
    // here rather than inside the shared query definition.
    enabled: enabled && revisionId !== null,
  });
};

export const RevisionRow = ({
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
  const transport = useContentEditorialTransport();
  const [open, setOpen] = React.useState(false);

  const hasChanges = revision.changedFields.length > 0;

  const current = useRevisionSnapshot({
    contentTypeId,
    enabled: open,
    itemId: id,
    revisionId: revision.id,
  });
  const earlier = useRevisionSnapshot({
    contentTypeId,
    enabled: open,
    itemId: id,
    revisionId: previousId,
  });

  const detail = current.data?.revision ?? null;
  // The diff needs *both* halves before it can be trusted: rendering as soon as
  // the newer one lands would show every field as "added", because the older
  // snapshot it is being compared against has not arrived yet.
  const settled =
    !current.isPending && (previousId === null || !earlier.isPending);

  return (
    <li className="group/revision flex gap-3">
      <div
        aria-hidden
        className="flex flex-col items-center gap-1.5 self-stretch"
      >
        <span
          className={cn(
            "mt-2.5 size-2.5 shrink-0 rounded-full",
            OPERATION_TONES[revision.operation].dot,
            isCurrent && "ring-ring/20 ring-4",
          )}
        />
        <span className="bg-border w-px flex-1 group-last/revision:hidden" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 pb-5 group-last/revision:pb-0">
        <div className="flex min-h-8 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-medium tabular-nums">
            v{revision.version}
          </span>
          <OperationBadge operation={revision.operation} />
          {isCurrent ? <Badge variant="secondary">{t("current")}</Badge> : null}

          <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-sm">
            <RevisionActor revision={revision} />
            <span aria-hidden className="text-muted-foreground/40">
              ·
            </span>
            <DateFormat date={revision.createdAt} />
          </span>

          <div className="ms-auto flex items-center gap-1.5">
            {hasChanges ? (
              <Button
                aria-expanded={open}
                onClick={() => {
                  setOpen(!open);
                }}
                size="sm"
                type="button"
                variant="ghost"
              >
                <ChevronDownIcon
                  aria-hidden
                  className={cn("transition-transform", open && "rotate-180")}
                />
                {open ? t("hide_changes") : t("show_changes")}
              </Button>
            ) : null}

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
                  const mutation = await transport.restoreRevision(
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

                    return;
                  }

                  await transport.settled({
                    contentTypeId,
                    itemId: id,
                    scope: "record",
                  });

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
                  <RotateCcwIcon aria-hidden />
                  {t("restore.action")}
                </Button>
              </ConfirmActionAlertDialog>
            ) : null}
          </div>
        </div>

        {!hasChanges ? (
          <p className="text-muted-foreground text-sm">{t("no_changes")}</p>
        ) : open ? (
          <div className="bg-muted/40 animate-in fade-in-0 slide-in-from-top-1 rounded-lg border p-3 duration-150">
            <p className="text-muted-foreground mb-2.5 text-xs">
              {t("changed_fields", {
                fields: revision.changedFields.join(", "),
              })}
            </p>

            {detail ? (
              <RevisionDiff
                after={detail.snapshot}
                before={earlier.data?.revision?.snapshot ?? null}
                spec={spec}
              />
            ) : settled ? (
              <p className="text-muted-foreground text-sm">
                {t("load_failed")}
              </p>
            ) : (
              <div className="text-muted-foreground flex justify-center py-2">
                <Loader small />
              </div>
            )}
          </div>
        ) : null}
      </div>
    </li>
  );
};
