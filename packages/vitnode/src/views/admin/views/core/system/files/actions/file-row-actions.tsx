import {
  CaptionsIcon,
  DownloadIcon,
  LoaderCircleIcon,
  Trash2Icon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { FileInUse } from "@/lib/files/in-use";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { useAdminStaffPermission } from "@/components/staff-permission/provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { TooltipWithContent } from "@/components/ui/tooltip";
import { CONFIG_PLUGIN } from "@/config";
import { fetcherClient } from "@/lib/fetcher-client";

import type { DeleteAdminFile } from "../files-delete";

const FileAltContent = React.lazy(async () =>
  import("../alt/file-alt-content").then(module => ({
    default: module.FileAltContent,
  })),
);

const FILES_EDIT_ALT = {
  module: "files",
  permission: "can_edit_alt",
  plugin: CONFIG_PLUGIN.pluginId,
} as const;

/** Opens an image's ALT text. Anyone on this screen may read it. */
const EditAltAction = ({ id, name }: { id: number; name: string }) => {
  const t = useTranslations("admin.system.files.alt");
  const canEdit = useAdminStaffPermission(FILES_EDIT_ALT);

  return (
    <Dialog>
      <TooltipWithContent text={t("open")}>
        <DialogTrigger
          render={
            <Button aria-label={t("open")} size="icon-sm" variant="ghost" />
          }
        >
          <CaptionsIcon />
        </DialogTrigger>
      </TooltipWithContent>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription className="truncate">{name}</DialogDescription>
        </DialogHeader>
        <React.Suspense
          fallback={
            <div className="flex items-center justify-center p-6">
              <Spinner size="xl" />
            </div>
          }
        >
          <FileAltContent canEdit={canEdit} fileId={id} />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
};

export const FileRowActions = ({
  canDelete,
  canDownload,
  id,
  mimeType,
  name,
  onDelete,
}: {
  canDelete: boolean;
  canDownload: boolean;
  id: number;
  /** Images get an ALT text action. */
  mimeType?: null | string;
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
      const res = await fetcherClient({
        plugin: CONFIG_PLUGIN.pluginId,
        module: "admin/files",
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

  const isImage = mimeType?.startsWith("image/") ?? false;

  if (!canDownload && !canDelete && !isImage) {
    return null;
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {isImage ? <EditAltAction id={id} name={name} /> : null}

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
          icon={<Trash2Icon />}
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
