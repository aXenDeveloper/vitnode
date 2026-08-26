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
  const [settled, setSettled] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  const hasChanges = revision.changedFields.length > 0;

  React.useEffect(() => {
    if (!open) return;

    const needsDetail = detail === null;
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

                    return;
                  }

                  toast.success(t("restore.success", { name: singular }), {
                    description: t("restore.success_desc", {
                      version: revision.version,
                    }),
                  });
                  onClose();
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
