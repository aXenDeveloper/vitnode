"use client";

import { DownloadIcon, LoaderCircleIcon, Trash2Icon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { FileInUse } from "@/lib/files/in-use";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { Button } from "@/components/ui/button";
import { TooltipWithContent } from "@/components/ui/tooltip";
import { fetcherClient } from "@/lib/fetcher-client";

import type { DeleteAdminFile } from "../files-delete";

import { filesAdminModuleRef } from "../files-query";

/**
 * Download and delete, on one row of the AdminCP file table.
 *
 * `onDelete` is the one thing it cannot decide for itself: in Next.js the delete
 * ends in `revalidatePath` and so has to be a server action, and in TanStack
 * Start it is a browser call followed by a query invalidation. Both are
 * `DeleteAdminFile`, so the row takes one and stops caring - see
 * `../files-delete.ts`.
 *
 * The *download* is not a seam. It is already a browser fetch that turns the
 * response into an object URL and clicks an anchor at it, which is the only way
 * to do it in either framework: a server action cannot hand a browser a file to
 * save.
 */
export const FileRowActions = ({
  canDelete,
  canDownload,
  id,
  name,
  onDelete,
}: {
  canDelete: boolean;
  canDownload: boolean;
  id: number;
  name: string;
  onDelete: DeleteAdminFile;
}) => {
  const t = useTranslations("admin.system.files");
  const tGlobal = useTranslations("core.global.errors");
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [heldByRevisions, setHeldByRevisions] =
    React.useState<FileInUse | null>(null);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const res = await fetcherClient(filesAdminModuleRef, {
        prefixPath: "/admin",
        module: "files",
        path: "/{id}/download",
        method: "get",
        args: { params: { id: String(id) } },
        options: { credentials: "include" },
      });
      if (!res.ok) throw new Error(await res.text());

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = name;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      toast.error(tGlobal("title"), {
        description: t("download.error"),
      });
    } finally {
      setIsDownloading(false);
    }
  };

  if (!canDownload && !canDelete) {
    return null;
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {canDownload && (
        <TooltipWithContent text={t("actions.download")}>
          <Button
            aria-label={t("actions.download")}
            disabled={isDownloading}
            onClick={handleDownload}
            size="icon-sm"
            variant="ghost"
          >
            {isDownloading ? (
              <LoaderCircleIcon className="animate-spin" />
            ) : (
              <DownloadIcon />
            )}
          </Button>
        </TooltipWithContent>
      )}

      {canDelete && (
        <ConfirmActionAlertDialog
          description={
            heldByRevisions
              ? t("delete.in_use.revisions.desc", {
                  count: heldByRevisions.revisions,
                })
              : t("delete.desc")
          }
          onOpenChange={open => {
            if (!open) setHeldByRevisions(null);
          }}
          onSubmit={async ({ onClose }) => {
            const result = await onDelete({
              force: heldByRevisions !== null,
              id,
            });
            if (result.error) {
              const { inUse } = result.error;

              if (inUse && !inUse.content && inUse.revisions > 0) {
                setHeldByRevisions(inUse);

                return;
              }

              toast.error(tGlobal("title"), {
                description: inUse
                  ? t("delete.in_use.content")
                  : tGlobal("internal_server_error"),
              });

              return;
            }

            toast.success(t("delete.success"));
            onClose();
          }}
          textSubmit={
            heldByRevisions
              ? t("delete.in_use.revisions.confirm")
              : t("delete.confirm")
          }
          title={t("delete.title")}
        >
          <Button
            aria-label={t("actions.delete")}
            size="icon-sm"
            variant="destructive"
          >
            <Trash2Icon />
          </Button>
        </ConfirmActionAlertDialog>
      )}
    </div>
  );
};
