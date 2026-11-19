import {
  CONTENT_CONTAINER_ICON_MIME_TYPES,
  parseContentContainerIcon,
} from "@vitnode/api/content/containers/icon";
import { serializeEmojiIcon } from "@vitnode/api/lib/emoji-icon";
import { formatBytes } from "@vitnode/api/lib/format-bytes";
import { Trash2Icon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { ItemAutoFormComponentProps } from "@/components/form/auto-form";

import { AutoFormLabel } from "@/components/form/common/label";
import {
  FileConstraintsLine,
  FileDropzone,
} from "@/components/form/fields/file-shared";
import { Button } from "@/components/ui/button";
import { EmojiIconPicker } from "@/components/ui/emoji-icon-picker";
import { FormControl, FormMessage } from "@/components/ui/form";

import type {
  ContentContainerIconUploadErrorCode,
  ContentContainerIconUploadResult,
} from "./container-request";

const ACCEPTED_TYPES: ReadonlySet<string> = new Set(
  CONTENT_CONTAINER_ICON_MIME_TYPES,
);

export const AutoFormContainerIcon = ({
  field,
  isOptional,
  label,
  maxBytes,
  onUpload,
}: Pick<ItemAutoFormComponentProps, "field" | "label"> & {
  isOptional: boolean;
  maxBytes: number;
  onUpload: (file: File) => Promise<ContentContainerIconUploadResult>;
}) => {
  const t = useTranslations("core.containers.form.icon");
  const [isUploading, setIsUploading] = React.useState(false);
  const [hasFailed, setHasFailed] = React.useState(false);
  const value = typeof field.value === "string" ? field.value : "";
  const parsed = parseContentContainerIcon(value);
  const image = parsed?.type === "image" ? parsed.value : null;

  const refuse = (code: ContentContainerIconUploadErrorCode | undefined) => {
    setHasFailed(true);
    switch (code) {
      case "forbidden":
        toast.error(t("uploadFailed"), { description: t("forbiddenDesc") });
        break;
      case "invalidFile":
        toast.error(t("uploadFailed"), { description: t("invalidFileDesc") });
        break;
      case "storageUnavailable":
        toast.error(t("uploadFailed"), {
          description: t("storageUnavailableDesc"),
        });
        break;
      case "tooLarge":
        toast.error(t("tooLarge"), {
          description: t("tooLargeDesc", { max: formatBytes(maxBytes) }),
        });
        break;
      case "unprocessable":
        toast.error(t("uploadFailed"), {
          description: t("unprocessableDesc"),
        });
        break;
      case "wrongType":
        toast.error(t("wrongType"), { description: t("wrongTypeDesc") });
        break;
      case "notIconField":
      case undefined:
        toast.error(t("uploadFailed"), { description: t("uploadFailedDesc") });
    }
  };

  const upload = async (file: File) => {
    if (!ACCEPTED_TYPES.has(file.type)) {
      refuse("wrongType");

      return;
    }
    if (file.size > maxBytes) {
      refuse("tooLarge");

      return;
    }

    setIsUploading(true);
    try {
      const result = await onUpload(file);
      if ("error" in result) {
        refuse(result.error.code);

        return;
      }

      setHasFailed(false);
      field.onChange(result.data.value);
      toast.success(t("uploaded"), { description: t("uploadedDesc") });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      {!!label && (
        <AutoFormLabel isOptional={isOptional}>{label}</AutoFormLabel>
      )}

      <FormControl>
        <EmojiIconPicker
          allowRemove
          disabled={isUploading}
          onBlur={field.onBlur}
          onChange={next => field.onChange(serializeEmojiIcon(next))}
          value={parsed?.type === "image" ? undefined : parsed}
        />
      </FormControl>

      {image ? (
        <div className="flex items-center gap-3 rounded-xl border p-2">
          <img
            alt={t("preview")}
            className="bg-muted size-12 shrink-0 rounded-lg object-cover"
            src={image}
          />
          <span className="text-muted-foreground min-w-0 flex-1 text-sm leading-relaxed text-pretty">
            {t("inUse")}
          </span>
          <Button
            onClick={() => field.onChange("")}
            size="sm"
            type="button"
            variant="ghost"
          >
            <Trash2Icon aria-hidden="true" />
            {t("remove")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <FileDropzone
            accept={CONTENT_CONTAINER_ICON_MIME_TYPES.join(",")}
            onPick={files => {
              const [file] = files;
              if (file) void upload(file);
            }}
            pending={isUploading}
            promptLabel={t("drop")}
            state={isUploading ? "uploading" : hasFailed ? "error" : "idle"}
          />
          <FileConstraintsLine
            allowedMimeTypes={CONTENT_CONTAINER_ICON_MIME_TYPES}
            maxBytes={maxBytes}
          />
        </div>
      )}

      <FormMessage />
    </>
  );
};
