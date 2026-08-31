"use client";

import { useMutation } from "@tanstack/react-query";
import {
  HardDriveIcon,
  ImageIcon,
  LoaderCircleIcon,
  XIcon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { debugAdminModule } from "@/api/modules/admin/debug/debug.admin.module";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from "@/components/ui/attachment";
import { CONFIG_PLUGIN } from "@/config";
import { clientModule, fetcherClient } from "@/lib/fetcher-client";

export const ContentTestStorage = () => {
  const t = useTranslations("admin.system.integrations.storage.test");
  const tError = useTranslations("core.global.errors");
  const [fileName, setFileName] = React.useState<string>();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetcherClient(
        clientModule<typeof debugAdminModule>(CONFIG_PLUGIN.pluginId),
        {
          prefixPath: "/admin",
          module: "debug",
          path: "/test-storage-upload",
          method: "post",
          formData,
          options: { credentials: "include" },
        },
      );
      if (!res.ok) throw new Error(await res.text());

      return await res.json();
    },
    onError: () =>
      toast.error(tError("title"), {
        description: tError("internal_server_error"),
      }),
    onSuccess: () => toast.success(t("upload.success")),
  });

  const state = upload.isError
    ? "error"
    : upload.isPending
      ? "uploading"
      : upload.data
        ? "done"
        : "idle";

  const description =
    state === "uploading"
      ? t("upload.pending")
      : state === "error"
        ? t("upload.error")
        : state === "done"
          ? t("upload.done")
          : t("upload.desc");

  const reset = () => {
    upload.reset();
    setFileName(undefined);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <HardDriveIcon />
        <AlertTitle>{t("info.title")}</AlertTitle>
        <AlertDescription>{t("info.desc")}</AlertDescription>
      </Alert>

      <input
        accept="image/*"
        className="hidden"
        onChange={event => {
          const file = event.target.files?.[0];
          if (file) {
            setFileName(file.name);
            upload.mutate(file);
          }
          event.target.value = "";
        }}
        ref={inputRef}
        type="file"
      />

      <Attachment className="w-full" state={state}>
        <AttachmentMedia variant={upload.data ? "image" : "icon"}>
          {upload.data ? (
            <img alt={fileName ?? t("upload.label")} src={upload.data.url} />
          ) : upload.isPending ? (
            <LoaderCircleIcon className="animate-spin" data-slot="spinner" />
          ) : (
            <ImageIcon />
          )}
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>{fileName ?? t("upload.label")}</AttachmentTitle>
          <AttachmentDescription>{description}</AttachmentDescription>
        </AttachmentContent>
        {upload.data ? (
          <AttachmentActions>
            <AttachmentAction onClick={reset} type="button">
              <XIcon />
            </AttachmentAction>
          </AttachmentActions>
        ) : (
          <AttachmentTrigger
            disabled={upload.isPending}
            onClick={() => inputRef.current?.click()}
          />
        )}
      </Attachment>
    </div>
  );
};
