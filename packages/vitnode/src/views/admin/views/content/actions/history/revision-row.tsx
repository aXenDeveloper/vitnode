// No "use client": reached only from `history-action`, which is a client entry.
import { ChevronDownIcon, RotateCcwIcon } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { cn } from "@/lib/utils";

import { contentErrorKey } from "../../lib/mutation-feedback";
import {
  getContentRevisionAction,
  restoreContentRevisionAction,
} from "../mutation-api.server";
import { RevisionActor } from "./revision-actor";
import { RevisionDiff } from "./revision-diff";

/**
 * The colour each operation carries.
 *
 * One map rather than two, so the dot on the rail can never disagree with the
 * badge beside it - the dot is the thing that makes a long history scannable,
 * and it is only worth anything if its colour means the same as the word.
 */
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
  // The one state that is an absence: taken back down, and deliberately the only
  // entry with no colour of its own.
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

/** `create` reads better as "Created" than as a raw operation name. */
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
 * One entry on the timeline: metadata always, the snapshot only once opened.
 *
 * Loading every snapshot up front would mean shipping every historical version
 * of a long article to the browser to render a list of dates.
 */
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

  // A publish or an unpublish moves no field, and the server says so rather than
  // leaving it to be discovered: there is nothing behind the toggle, so the row
  // states the fact instead of offering an empty panel to open.
  const hasChanges = revision.changedFields.length > 0;

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
    <li className="group/revision flex gap-3">
      {/* The rail. The line stretches to the bottom of the entry, so it meets
          the next dot instead of stopping under the text. */}
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
        {/* `min-h-8` keeps every entry on the same rhythm whether or not it has
            buttons, which is also what the dot above aligns to. */}
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
                // No `aria-controls`: the panel it names does not exist while
                // the row is collapsed, and a dangling reference is worse than
                // none. `aria-expanded` on a button whose disclosure follows it
                // is the whole contract.
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

            {/* Keyed on the snapshot rather than on a loading flag, so a later
                fetch of the missing "before" refines the diff in place instead
                of replacing it with a spinner somebody has to wait out again. */}
            {detail ? (
              <RevisionDiff
                after={detail.snapshot}
                before={previous?.snapshot ?? null}
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
