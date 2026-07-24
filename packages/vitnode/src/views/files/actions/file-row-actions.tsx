"use client";

import { DownloadIcon, LoaderCircleIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import React from "react";
import { toast } from "sonner";

import type { userFilesModule } from "@/api/modules/users/files/files.module";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { Button } from "@/components/ui/button";
import { TooltipWithContent } from "@/components/ui/tooltip";
import { CONFIG_PLUGIN } from "@/config";
import { clientModule, fetcherClient } from "@/lib/fetcher-client";

import { deleteMyFileAction } from "./delete-action.server";

export const MyFileRowActions = ({
  id,
  name,
}: {
  id: number;
  name: string;
}) => {
  const t = useTranslations("core.files");
  const tGlobal = useTranslations("core.global.errors");
  const [isDownloading, setIsDownloading] = React.useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const res = await fetcherClient(
        clientModule<typeof userFilesModule>(CONFIG_PLUGIN.pluginId),
        {
          prefixPath: "/users",
          module: "files",
          path: "/{id}/download",
          method: "get",
          args: { params: { id: String(id) } },
          options: { credentials: "include" },
        },
      );
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

  return (
    <div className="flex items-center justify-end gap-1">
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

      <ConfirmActionAlertDialog
        description={t("delete.desc")}
        onSubmit={async ({ onClose }) => {
          const result = await deleteMyFileAction({ id });
          if (result.error) {
            toast.error(tGlobal("title"), {
              description: tGlobal("internal_server_error"),
            });

            return;
          }

          toast.success(t("delete.success"));
          onClose();
        }}
        textSubmit={t("delete.confirm")}
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
    </div>
  );
};
