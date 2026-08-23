"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { FileIcon, LoaderCircleIcon, UploadIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import React from "react";

import type { userFilesModule } from "@/api/modules/users/files/files.module";
import type { UploadedFile } from "@/lib/helpers/files";
import type { UploadLimits, UploadRejection } from "@/lib/upload-limits";

import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment";
import { Button } from "@/components/ui/button";
import { FormControl, FormMessage } from "@/components/ui/form";
import { CONFIG_PLUGIN } from "@/config";
import { clientModule, fetcherClient } from "@/lib/fetcher-client";
import { formatBytes } from "@/lib/format-bytes";
import { toUploadedFiles } from "@/lib/helpers/files";
import { validateUploadSelection } from "@/lib/upload-limits";
import { cn } from "@/lib/utils";

import type { ItemAutoFormComponentProps } from "../auto-form";

import { AutoFormDesc } from "../common/desc";
import { AutoFormLabel } from "../common/label";

/** What the field needs to know before it lets a file through. */
export interface UploadFieldLimits extends UploadLimits {
  allowedMimeTypes: string[];
  maxFiles: number;
  remainingBytes: null | number;
  usedBytes: number;
}

const filesModule = () =>
  clientModule<typeof userFilesModule>(CONFIG_PLUGIN.pluginId);

/** The current user's limits, straight from the core `files` module. */
export const fetchUploadLimits = async (): Promise<UploadFieldLimits> => {
  const res = await fetcherClient(filesModule(), {
    prefixPath: "/users",
    module: "files",
    path: "/upload-limits",
    method: "get",
    options: { credentials: "include" },
  });
  if (!res.ok) throw new Error(await res.text());

  return await res.json();
};

/** Uploads a batch through the core endpoint - all of it, or none of it. */
export const uploadFiles = async (files: File[]): Promise<UploadedFile[]> => {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }

  const res = await fetcherClient(filesModule(), {
    prefixPath: "/users",
    module: "files",
    path: "/",
    method: "post",
    formData,
    options: { credentials: "include" },
  });
  if (!res.ok) throw new Error(await res.text());

  return (await res.json()).files;
};

const deleteFile = async ({ id }: UploadedFile): Promise<void> => {
  const res = await fetcherClient(filesModule(), {
    prefixPath: "/users",
    module: "files",
    path: "/{id}",
    method: "delete",
    args: { params: { id: String(id) } },
    options: { credentials: "include" },
  });
  if (!res.ok) throw new Error(await res.text());
};

/** `image/png` -> `png`, `image/*` -> `image`: the half that carries meaning. */
const mimeTypeLabel = (mimeType: string): string => {
  const [type, subtype] = mimeType.split("/");

  return !subtype || subtype === "*" ? type : subtype;
};

const PENDING_LIMITS: UploadFieldLimits = {
  allowUpload: false,
  allowedMimeTypes: [],
  maxBytesPerSubmit: 0,
  maxFiles: 0,
  maxTotalBytes: 0,
  remainingBytes: 0,
  usedBytes: 0,
};

/**
 * Attaches files to an `AutoForm` field - several at once, by picking them or by
 * dropping them on the field.
 *
 * The value is the list of files that are **already stored**
 * ([`uploadedFilesSchema`](../../../lib/helpers/files.ts)), not the browser's
 * `File` objects: each selection is uploaded straight away, so a submit handler
 * only ever deals with ids that exist.
 *
 * ```ts
 * z.object({ attachments: uploadedFilesSchema({ max: 5 }) })
 * ```
 *
 * How much a user may upload comes from their roles, and the field asks the API
 * for it rather than guessing - so an over-quota batch is refused before it is
 * sent, with the same rule the route enforces. Pass `limits` and `upload` to
 * point the field at your own endpoint instead.
 */
export const AutoFormFiles = ({
  accept,
  description,
  disabled,
  field,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  itemParams,
  label,
  labelRight,
  limits: limitsProp,
  maxFiles: maxFilesProp,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  multiLang,
  onRemoved,
  onUploaded,
  otherProps,
  remove = deleteFile,
  upload = uploadFiles,
}: ItemAutoFormComponentProps & {
  /** `accept` for the file input. Defaults to the allowed MIME types. */
  accept?: string;
  disabled?: boolean;
  /** Skips the request for the user's limits - for previews and custom endpoints. */
  limits?: UploadFieldLimits;
  /** Caps the field on top of whatever the role and the endpoint allow. */
  maxFiles?: number;
  /** A file the field uploaded was removed again, and is gone from storage. */
  onRemoved?: (file: UploadedFile) => void;
  /** A batch landed - for refreshing whatever else lists the user's files. */
  onUploaded?: (files: UploadedFile[]) => void;
  /** Deletes a file this field uploaded. Pair it with a custom `upload`. */
  remove?: (file: UploadedFile) => Promise<void>;
  upload?: (files: File[]) => Promise<UploadedFile[]>;
}) => {
  const t = useTranslations("core.global.files");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [error, setError] = React.useState<null | string>(null);
  // Files uploaded by this field, so removing one cleans up after itself while
  // removing a file the form was opened with only detaches it.
  const uploadedHereRef = React.useRef(new Set<number>());

  const remoteLimits = useQuery({
    queryKey: ["vitnode", "files", "upload-limits"],
    queryFn: fetchUploadLimits,
    enabled: !limitsProp,
    staleTime: 60 * 1000,
  });
  const limits = limitsProp ?? remoteLimits.data ?? PENDING_LIMITS;

  const value = toUploadedFiles(field.value);
  const maxFiles = Math.min(
    ...[
      maxFilesProp,
      otherProps.maxItems,
      limits.maxFiles > 0 ? limits.maxFiles : undefined,
    ].filter((item): item is number => typeof item === "number"),
  );
  const isFull = Number.isFinite(maxFiles) && value.length >= maxFiles;
  const isLoadingLimits = !limitsProp && remoteLimits.isPending;
  const isDisabled =
    !!disabled || isFull || isLoadingLimits || !limits.allowUpload;

  const uploadMutation = useMutation({
    mutationFn: upload,
    onSuccess: uploaded => {
      for (const file of uploaded) {
        uploadedHereRef.current.add(file.id);
      }
      field.onChange([...value, ...uploaded]);
      void remoteLimits.refetch();
      onUploaded?.(uploaded);
    },
    onError: () => setError(t("errors.upload_failed")),
  });

  const messageFor = (rejection: UploadRejection): string => {
    switch (rejection.kind) {
      case "empty":
        return t("errors.empty");
      case "mime":
        return t("errors.mime", { name: rejection.fileName });
      case "not_allowed":
        return t("errors.not_allowed");
      case "quota":
        return t("errors.quota", {
          limit: formatBytes(rejection.limitBytes),
          remaining: formatBytes(rejection.remainingBytes),
        });
      case "submit_limit":
        return t("errors.submit_limit", {
          limit: formatBytes(rejection.limitBytes),
          total: formatBytes(rejection.totalBytes),
        });
      case "too_many":
        // The cap on the field, not the slots left - "only 5 files" is easier
        // to act on than "only 2 more".
        return t("errors.too_many", { count: maxFiles });
    }
  };

  const add = (selected: File[]) => {
    setError(null);
    const rejection = validateUploadSelection({
      allowedMimeTypes: limits.allowedMimeTypes,
      files: selected,
      limits,
      maxFiles: Number.isFinite(maxFiles) ? maxFiles - value.length : undefined,
      usedBytes: limits.usedBytes,
    });

    if (rejection) {
      setError(messageFor(rejection));

      return;
    }

    uploadMutation.mutate(selected);
  };

  const detach = async (file: UploadedFile) => {
    field.onChange(value.filter(item => item.id !== file.id));
    // Only files this field stored are deleted: one the form was opened with
    // belongs to whatever saved it, and a cancelled edit must not destroy it.
    if (!uploadedHereRef.current.delete(file.id)) return;

    try {
      await remove(file);
      void remoteLimits.refetch();
      onRemoved?.(file);
    } catch {
      // The form no longer references it; a failed cleanup is the admin panel's
      // problem, not something to fail the user's form over.
    }
  };

  const hint = isLoadingLimits
    ? ""
    : [
        limits.allowedMimeTypes.length > 0 &&
          t("hint.types", {
            types: [
              ...new Set(limits.allowedMimeTypes.map(mimeTypeLabel)),
            ].join(", "),
          }),
        Number.isFinite(maxFiles) && t("hint.files", { count: maxFiles }),
        limits.remainingBytes !== null &&
          t("hint.space", { size: formatBytes(limits.remainingBytes) }),
      ]
        .filter(Boolean)
        .join(" · ");

  return (
    <>
      {!!label && (
        <AutoFormLabel
          isOptional={otherProps.isOptional}
          labelRight={labelRight}
        >
          {label}
        </AutoFormLabel>
      )}

      <div
        className={cn(
          "border-input bg-card flex flex-col items-center gap-2 rounded-xl border border-dashed p-6 text-center transition-colors",
          {
            "border-primary bg-primary/5": isDragging,
            "border-destructive/50": !!error || otherProps["aria-invalid"],
            "opacity-60": isDisabled,
          },
        )}
        onDragLeave={event => {
          event.preventDefault();
          // Moving onto a child fires `dragleave` on the parent too, which
          // would flicker the highlight the whole way in.
          if (event.currentTarget.contains(event.relatedTarget as Node)) return;
          setIsDragging(false);
        }}
        onDragOver={event => {
          event.preventDefault();
          if (!isDisabled) setIsDragging(true);
        }}
        onDrop={event => {
          event.preventDefault();
          setIsDragging(false);
          if (isDisabled) return;
          add([...event.dataTransfer.files]);
        }}
      >
        <UploadIcon aria-hidden className="text-muted-foreground size-5" />

        <FormControl>
          <Button
            disabled={isDisabled || uploadMutation.isPending}
            isLoading={uploadMutation.isPending}
            onClick={() => inputRef.current?.click()}
            type="button"
            variant="outline"
          >
            {t(isFull ? "full" : "browse")}
          </Button>
        </FormControl>

        <span className="text-muted-foreground text-xs leading-relaxed">
          {limits.allowUpload || isLoadingLimits ? t("drop") : t("not_allowed")}
        </span>
        {!!hint && (
          <span className="text-muted-foreground text-xs leading-relaxed">
            {hint}
          </span>
        )}

        <input
          accept={accept ?? (limits.allowedMimeTypes.join(",") || undefined)}
          className="hidden"
          disabled={isDisabled}
          multiple
          onChange={event => {
            add([...(event.target.files ?? [])]);
            event.target.value = "";
          }}
          ref={inputRef}
          tabIndex={-1}
          type="file"
        />
      </div>

      {(value.length > 0 || uploadMutation.isPending) && (
        <AttachmentGroup>
          {value.map(file => (
            <Attachment key={file.id} orientation="horizontal" size="sm">
              <AttachmentMedia
                variant={file.mimeType?.startsWith("image/") ? "image" : "icon"}
              >
                {file.mimeType?.startsWith("image/") ? (
                  <img alt={file.name} loading="lazy" src={file.url} />
                ) : (
                  <FileIcon />
                )}
              </AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>{file.name}</AttachmentTitle>
                <AttachmentDescription>
                  {formatBytes(file.size)}
                </AttachmentDescription>
              </AttachmentContent>
              <AttachmentActions>
                <AttachmentAction
                  aria-label={t("remove", { name: file.name })}
                  disabled={disabled}
                  onClick={() => void detach(file)}
                  type="button"
                >
                  <XIcon />
                </AttachmentAction>
              </AttachmentActions>
            </Attachment>
          ))}

          {uploadMutation.isPending &&
            uploadMutation.variables.map(file => (
              <Attachment
                key={`pending-${file.name}-${file.size}-${file.lastModified}`}
                orientation="horizontal"
                size="sm"
                state="uploading"
              >
                <AttachmentMedia>
                  <LoaderCircleIcon
                    className="animate-spin"
                    data-slot="spinner"
                  />
                </AttachmentMedia>
                <AttachmentContent>
                  <AttachmentTitle>{file.name}</AttachmentTitle>
                  <AttachmentDescription>
                    {t("uploading")}
                  </AttachmentDescription>
                </AttachmentContent>
              </Attachment>
            ))}
        </AttachmentGroup>
      )}

      {!!error && (
        <p aria-live="polite" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {!!description && <AutoFormDesc>{description}</AutoFormDesc>}
      <FormMessage />
    </>
  );
};
