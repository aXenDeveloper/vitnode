import { useMutation } from "@tanstack/react-query";
import { RotateCcwIcon, XIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { AttachmentAction } from "@/components/ui/attachment";
import { Button } from "@/components/ui/button";
import { FormControl, FormMessage } from "@/components/ui/form";
import {
  fileAcceptAttribute,
  fileFormatLabels,
  validateFile,
} from "@/lib/file-constraints";
import { formatBytes } from "@/lib/format-bytes";

import type { ItemAutoFormComponentProps } from "../auto-form";
import type { AutoFormFileValue } from "./file-shared";
import type { FileUploadOptions } from "./file-upload-queue";

import { AutoFormDesc } from "../common/desc";
import { AutoFormLabel } from "../common/label";
import {
  FileCard,
  FileConstraintsLine,
  FileDropzone,
  FileError,
  resolveFormFiles,
  useUploadFailureMessage,
} from "./file-shared";

export type { AutoFormFileValue } from "./file-shared";
export type { FileUploadOptions } from "./file-upload-queue";

export interface AutoFormFileProps extends ItemAutoFormComponentProps {
  allowedExtensions?: readonly string[];
  allowedMimeTypes?: readonly string[];
  file?: AutoFormFileValue | null;
  label?: React.ReactNode;
  maxBytes: number;
  onUpload: (
    file: File,
    options: FileUploadOptions,
  ) => Promise<AutoFormFileValue>;
}

const fileFieldState = ({
  hasError,
  hasFile,
  isPending,
}: {
  hasError: boolean;
  hasFile: boolean;
  isPending: boolean;
}) => {
  if (isPending) return "uploading";
  if (hasError) return "error";

  return hasFile ? "done" : "idle";
};

const useFileUpload = ({
  constraints,
  onStored,
  onUpload,
}: {
  constraints: Parameters<typeof validateFile>[0] & { maxBytes: number };
  onStored: (stored: AutoFormFileValue) => void;
  onUpload: AutoFormFileProps["onUpload"];
}) => {
  const t = useTranslations("core.global.file");
  const failureMessage = useUploadFailureMessage();
  const [rejected, setRejected] = React.useState<null | string>(null);
  const [progress, setProgress] = React.useState<null | number>(null);
  const controllerRef = React.useRef<AbortController | null>(null);
  const formats = fileFormatLabels(constraints);

  const upload = useMutation({
    mutationFn: async (chosen: File) => {
      const controller = new AbortController();
      controllerRef.current = controller;
      setProgress(null);

      const stored = await onUpload(chosen, {
        onProgress: fraction => {
          if (!controller.signal.aborted) {
            setProgress(Math.min(1, Math.max(0, fraction)));
          }
        },
        signal: controller.signal,
      });
      controller.signal.throwIfAborted();

      return stored;
    },
    retry: false,
    onSuccess: stored => {
      setRejected(null);
      onStored(stored);
    },
  });

  const errorMessage =
    rejected ??
    failureMessage({
      attempted: upload.variables,
      error: upload.error,
      formats,
      maxBytes: constraints.maxBytes,
    });

  const pick = (chosen: File | undefined) => {
    if (!chosen) return;

    const rejection = validateFile(constraints, {
      mimeType: chosen.type,
      name: chosen.name,
      size: chosen.size,
    });
    if (rejection) {
      upload.reset();
      setRejected(
        rejection.reason === "size"
          ? t("errors.too_large", {
              max: formatBytes(constraints.maxBytes),
              size: rejection.value,
            })
          : t("errors.wrong_format", {
              formats: formats.join(", "),
              value: rejection.value,
            }),
      );

      return;
    }

    setRejected(null);
    upload.mutate(chosen);
  };

  const cancel = () => {
    controllerRef.current?.abort();
    upload.reset();
    setProgress(null);
  };

  const retry = () => {
    if (upload.variables) upload.mutate(upload.variables);
  };

  const reset = () => {
    upload.reset();
    setRejected(null);
  };

  return {
    cancel,
    errorMessage,
    pick,
    progress,
    rejected,
    reset,
    retry,
    upload,
  };
};

export const AutoFormFile = ({
  allowedExtensions,
  allowedMimeTypes,
  description,
  field,
  file: initialFile,
  label,
  labelRight,
  maxBytes,
  onUpload,
  otherProps: { isOptional },
  // Only the language-aware inputs implement this - dropped here so it never
  // lands on the DOM element below. A file is never localized.
  // oxlint-disable-next-line no-unused-vars
  multiLang,
  // oxlint-disable-next-line no-unused-vars
  itemParams,
}: AutoFormFileProps) => {
  const t = useTranslations("core.global.file");
  const [uploaded, setUploaded] = React.useState<AutoFormFileValue[]>([]);
  const [resolved] = resolveFormFiles(field.value, [initialFile, ...uploaded]);
  const file = resolved?.file ?? null;

  const constraints = { allowedExtensions, allowedMimeTypes, maxBytes };
  const accept = fileAcceptAttribute(constraints);
  const {
    cancel,
    errorMessage,
    pick,
    progress,
    rejected,
    reset,
    retry,
    upload,
  } = useFileUpload({
    constraints,
    onStored: stored => {
      setUploaded(current => [...current, stored]);
      field.onChange(stored.id);
    },
    onUpload,
  });

  const remove = () => {
    reset();
    field.onChange(null);
  };

  const state = fileFieldState({
    hasError: errorMessage !== null,
    hasFile: !!resolved,
    isPending: upload.isPending,
  });

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
        maxBytes={maxBytes}
      />

      <FormControl>
        <div className="flex flex-col gap-2">
          {resolved && !upload.isPending ? (
            <FileCard
              file={
                file ?? { id: resolved.id, name: t("stored"), size: 0, url: "" }
              }
              state={state}
            >
              <ReplaceAction accept={accept} onPick={pick} />
              <AttachmentAction
                aria-label={t("remove")}
                onClick={remove}
                type="button"
              >
                <XIcon />
              </AttachmentAction>
            </FileCard>
          ) : (
            <FileDropzone
              accept={accept}
              onCancel={cancel}
              onPick={files => pick(files[0])}
              pending={upload.isPending}
              progress={progress}
              promptLabel={t("drop")}
              state={state}
            />
          )}

          {errorMessage !== null && (
            <FileError
              action={
                rejected === null && upload.isError ? (
                  <Button
                    onClick={retry}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <RotateCcwIcon aria-hidden />
                    {t("retry")}
                  </Button>
                ) : null
              }
            >
              {errorMessage}
            </FileError>
          )}
        </div>
      </FormControl>

      {!!description && <AutoFormDesc>{description}</AutoFormDesc>}
      <FormMessage />
    </>
  );
};

const ReplaceAction = ({
  accept,
  onPick,
}: {
  accept?: string;
  onPick: (file: File | undefined) => void;
}) => {
  const t = useTranslations("core.global.file");
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        accept={accept}
        className="hidden"
        onChange={event => {
          onPick(event.target.files?.[0]);
          event.target.value = "";
        }}
        ref={inputRef}
        tabIndex={-1}
        type="file"
      />
      <AttachmentAction
        aria-label={t("replace")}
        onClick={() => inputRef.current?.click()}
        type="button"
      >
        <RotateCcwIcon />
      </AttachmentAction>
    </>
  );
};
