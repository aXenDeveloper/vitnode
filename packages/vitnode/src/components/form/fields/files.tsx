"use client";

import { useMutation } from "@tanstack/react-query";
import React from "react";
import { useTranslations } from "use-intl";

import { FormControl, FormMessage } from "@/components/ui/form";
import {
  fileAcceptAttribute,
  fileFormatLabels,
  validateFile,
} from "@/lib/file-constraints";
import { formatBytes } from "@/lib/format-bytes";

import type { ItemAutoFormComponentProps } from "../auto-form";
import type { FileGalleryRow } from "./file-gallery";
import type { AutoFormFileValue } from "./file-shared";
import type { FileUploadQueue } from "./file-upload-queue";

import { AutoFormDesc } from "../common/desc";
import { AutoFormLabel } from "../common/label";
import { FileGallery } from "./file-gallery";
import { planFileGallery, removeFileId } from "./file-order";
import {
  FileConstraintsLine,
  FileDropzone,
  FileError,
  resolveFormFiles,
  useUploadFailureMessage,
} from "./file-shared";
import {
  createFileUploadQueue,
  EMPTY_FILE_UPLOAD_QUEUE_STATE,
} from "./file-upload-queue";

export interface AutoFormFilesProps extends ItemAutoFormComponentProps {
  allowedExtensions?: readonly string[];
  allowedMimeTypes?: readonly string[];
  files?: AutoFormFileValue[];
  label?: React.ReactNode;
  maxBytes: number;
  maxItems: number;
  minItems?: number;
  onUpload: (file: File) => Promise<AutoFormFileValue>;
  ordered?: boolean;
}

export const AutoFormFiles = ({
  allowedExtensions,
  allowedMimeTypes,
  description,
  field,
  files: initialFiles,
  label,
  labelRight,
  maxBytes,
  maxItems,
  minItems = 0,
  onUpload,
  ordered = true,
  otherProps: { isOptional },
  // Only the language-aware inputs implement this - dropped here so it never
  // lands on the DOM element below. A file is never localized.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  multiLang,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  itemParams,
}: AutoFormFilesProps) => {
  const t = useTranslations("core.global.file");
  const failureMessage = useUploadFailureMessage();
  const [queued, setQueued] = React.useState(EMPTY_FILE_UPLOAD_QUEUE_STATE);
  const [rejections, setRejections] = React.useState<string[]>([]);
  const [uploaded, setUploaded] = React.useState<AutoFormFileValue[]>([]);

  const constraints = { allowedExtensions, allowedMimeTypes, maxBytes };
  const formats = fileFormatLabels(constraints);
  const accept = fileAcceptAttribute(constraints);

  const resolved = resolveFormFiles(field.value, [
    ...(initialFiles ?? []),
    ...uploaded,
  ]);
  const ids = resolved.map(entry => entry.id);

  const idsRef = React.useRef<number[]>([]);
  React.useEffect(() => {
    idsRef.current = ids;
  });

  const commit = (next: readonly number[]) => {
    idsRef.current = [...next];
    field.onChange([...next]);
  };

  const upload = useMutation({
    mutationFn: async (file: File) => await onUpload(file),
    retry: false,
  });

  const settle = ({
    error,
    file,
    stored,
  }: {
    error?: unknown;
    file: File;
    stored?: AutoFormFileValue;
  }) => {
    if (stored) {
      setUploaded(current => [...current, stored]);

      return;
    }

    const message = failureMessage({
      attempted: file,
      error,
      formats,
      maxBytes,
    });
    if (message === null) return;

    setRejections(current => [
      ...current,
      t("errors.named", { message, name: file.name }),
    ]);
  };

  const latestRef = React.useRef({ commit, settle, upload });
  React.useEffect(() => {
    latestRef.current = { commit, settle, upload };
  });

  const queueRef = React.useRef<FileUploadQueue | null>(null);
  queueRef.current ??= createFileUploadQueue({
    ids: () => idsRef.current,
    onChange: next => {
      latestRef.current.commit(next);
    },
    onSettled: result => {
      latestRef.current.settle(result);
    },
    onStateChange: setQueued,
    upload: async file => await latestRef.current.upload.mutateAsync(file),
  });
  const queue = queueRef.current;

  const pending = queued.pending;
  const remaining = maxItems - ids.length - pending.length;

  const pick = (chosen: File[]) => {
    setRejections([]);

    const accepted: File[] = [];
    const refused: string[] = [];

    for (const file of chosen) {
      if (accepted.length >= remaining) {
        refused.push(t("errors.too_many", { max: maxItems, name: file.name }));
        continue;
      }

      const rejection = validateFile(constraints, {
        mimeType: file.type,
        name: file.name,
        size: file.size,
      });
      if (!rejection) {
        accepted.push(file);
        continue;
      }

      refused.push(
        t("errors.named", {
          message:
            rejection.reason === "size"
              ? t("errors.too_large", {
                  max: formatBytes(maxBytes),
                  size: rejection.value,
                })
              : t("errors.wrong_format", {
                  formats: formats.join(", "),
                  value: rejection.value,
                }),
          name: file.name,
        }),
      );
    }

    if (refused.length > 0) setRejections(refused);

    queue.enqueue(accepted);
  };

  const remove = (id: number) => {
    setRejections([]);
    commit(removeFileId(ids, id));
  };

  const descriptors = new Map(resolved.map(entry => [entry.id, entry.file]));
  const pendingByOrder = new Map(pending.map(entry => [entry.order, entry]));
  const rows = planFileGallery({
    anchorId: queued.anchorId,
    ids,
    pending,
    placed: queued.placed,
  }).flatMap<FileGalleryRow>(token => {
    if (token.kind === "file") {
      return [
        { file: descriptors.get(token.id) ?? null, id: token.id, kind: "file" },
      ];
    }

    const entry = pendingByOrder.get(token.order);

    return entry
      ? [
          {
            kind: "pending" as const,
            name: entry.name,
            order: entry.order,
            size: entry.size,
          },
        ]
      : [];
  });

  const state =
    pending.length > 0
      ? "uploading"
      : rejections.length > 0
        ? "error"
        : ids.length > 0
          ? "done"
          : "idle";

  return (
    <>
      {!!label && (
        <AutoFormLabel isOptional={isOptional} labelRight={labelRight}>
          {label}
        </AutoFormLabel>
      )}

      <FileConstraintsLine
        allowedExtensions={allowedExtensions}
        allowedMimeTypes={allowedMimeTypes}
        count={{ max: maxItems, used: ids.length }}
        maxBytes={maxBytes}
      />

      <FormControl>
        <div className="flex flex-col gap-2">
          <FileDropzone
            accept={accept}
            disabled={remaining <= 0}
            disabledLabel={t("full", { max: maxItems })}
            multiple
            onPick={pick}
            pending={false}
            promptLabel={t("drop_many")}
            state={state}
          />

          {rows.length > 0 && (
            <FileGallery
              canRemove={ids.length > minItems}
              onRemove={remove}
              onReorder={commit}
              ordered={ordered}
              rows={rows}
            />
          )}

          {rejections.map(message => (
            <FileError key={message}>{message}</FileError>
          ))}
        </div>
      </FormControl>

      {!!description && <AutoFormDesc>{description}</AutoFormDesc>}
      <FormMessage />
    </>
  );
};
