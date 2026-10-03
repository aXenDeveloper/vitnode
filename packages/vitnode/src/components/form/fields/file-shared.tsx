import { cn } from "cn";
import {
  FileIcon,
  LoaderCircleIcon,
  RotateCcwIcon,
  TriangleAlertIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import type { FileRejectionReason } from "@/lib/file-constraints";

import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { fileFormatLabels } from "@/lib/file-constraints";
import { formatBytes } from "@/lib/format-bytes";

export interface AutoFormFileValue {
  height?: number;
  id: number;
  mimeType?: null | string;
  name: string;
  size: number;
  url: string;
  width?: number;
}

export const fileRejectionReasonOf = (
  error: unknown,
): FileRejectionReason | undefined => {
  const reason = (error as null | { reason?: unknown })?.reason;

  return reason === "extension" || reason === "mimeType" || reason === "size"
    ? reason
    : undefined;
};

export const isImageFile = (file: AutoFormFileValue): boolean =>
  file.url !== "" && (file.mimeType ?? "").startsWith("image/");

/** One entry of what a file control should show: the id, and what is known of it. */
export interface ResolvedFormFile {
  file: AutoFormFileValue | null;
  id: number;
}

/** One positive integer, or `null` - the only thing a file value can be. */
const asFileId = (value: unknown): null | number =>
  typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;

export const fileIdsOfFormValue = (value: unknown): number[] => {
  if (Array.isArray(value)) {
    return value.map(asFileId).filter((id): id is number => id !== null);
  }

  const id = asFileId(value);

  return id === null ? [] : [id];
};

export const resolveFormFiles = (
  value: unknown,
  known: readonly (AutoFormFileValue | null | undefined)[],
): ResolvedFormFile[] => {
  const byId = new Map(
    known
      .filter((file): file is AutoFormFileValue => !!file)
      .map(file => [file.id, file]),
  );

  return fileIdsOfFormValue(value).map(id => ({
    file: byId.get(id) ?? null,
    id,
  }));
};

export const useUploadFailureMessage = (): ((args: {
  attempted: File | undefined;
  error: unknown;
  formats: readonly string[];
  maxBytes: number;
}) => null | string) => {
  const t = useTranslations("core.global.file");

  return React.useCallback(
    ({ attempted, error, formats, maxBytes }) => {
      if (!(error instanceof Error)) return null;

      const reason = fileRejectionReasonOf(error);

      if (reason === "size" && attempted) {
        return t("errors.too_large", {
          max: formatBytes(maxBytes),
          size: formatBytes(attempted.size),
        });
      }
      if (reason !== undefined && attempted) {
        return t("errors.wrong_format", {
          formats: formats.join(", "),
          value:
            reason === "mimeType" && attempted.type !== ""
              ? attempted.type
              : attempted.name,
        });
      }

      return error.message;
    },
    [t],
  );
};

export const FileConstraintsLine = ({
  allowedExtensions,
  allowedMimeTypes,
  count,
  maxBytes,
}: {
  allowedExtensions?: readonly string[];
  allowedMimeTypes?: readonly string[];
  count?: { max: number; used: number };
  maxBytes: number;
}) => {
  const t = useTranslations("core.global.file");
  const formats = fileFormatLabels({
    allowedExtensions,
    allowedMimeTypes,
    maxBytes,
  });

  return (
    <div className="text-muted-foreground flex flex-col gap-0.5 text-xs">
      <span data-slot="file-formats">
        {formats.length > 0 ? formats.join(", ") : t("any_format")}
      </span>
      <span data-slot="file-max-size">
        {t("max_size", { size: formatBytes(maxBytes) })}
        {count
          ? ` · ${t("count", { max: count.max, used: count.used })}`
          : null}
      </span>
    </div>
  );
};

const carriesFiles = (event: React.DragEvent) =>
  [...event.dataTransfer.types].includes("Files");

const UploadProgress = ({
  label,
  progress,
}: {
  label: string;
  progress: number;
}) => {
  const percent = Math.round(progress * 100);

  return (
    <div className="flex w-full items-center gap-2" data-slot="file-progress">
      <Progress aria-label={label} className="flex-1" value={percent} />
      <span className="text-muted-foreground w-9 shrink-0 text-end text-xs tabular-nums">
        {percent}%
      </span>
    </div>
  );
};

export const FileDropzone = ({
  accept,
  disabled,
  disabledLabel,
  multiple = false,
  onCancel,
  onPick,
  pending,
  progress = null,
  promptLabel,
  state,
}: {
  accept?: string;
  disabled?: boolean;
  disabledLabel?: string;
  multiple?: boolean;
  onCancel?: () => void;
  onPick: (files: File[]) => void;
  pending: boolean;
  progress?: null | number;
  promptLabel: string;
  state: "done" | "error" | "idle" | "uploading";
}) => {
  const t = useTranslations("core.global.file");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dragDepthRef = React.useRef(0);
  const [isDragging, setIsDragging] = React.useState(false);
  const isInteractive = !disabled && !pending;

  const pick = (list: FileList | null) => {
    if (!isInteractive) return;

    const files = [...(list ?? [])];
    if (files.length > 0) onPick(files);
  };

  const endDrag = () => {
    dragDepthRef.current = 0;
    setIsDragging(false);
  };

  return (
    <>
      <input
        accept={accept}
        className="hidden"
        data-slot="file-input"
        disabled={!isInteractive}
        multiple={multiple}
        onChange={event => {
          pick(event.target.files);
          event.target.value = "";
        }}
        ref={inputRef}
        tabIndex={-1}
        type="file"
      />
      <div
        className={cn(
          "border-input ease-fluid flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center transition-colors duration-150 motion-reduce:transition-none",
          isInteractive && "hover:bg-muted/50 cursor-pointer",
          isDragging && "border-primary bg-primary/5",
          state === "error" && "border-destructive/40",
          disabled && "opacity-60",
        )}
        data-dragging={isDragging ? "" : undefined}
        data-slot="file-dropzone"
        onClick={() => {
          if (isInteractive) inputRef.current?.click();
        }}
        onDragEnter={event => {
          if (!carriesFiles(event)) return;

          event.preventDefault();
          dragDepthRef.current += 1;
          if (isInteractive) setIsDragging(true);
        }}
        onDragLeave={event => {
          if (!carriesFiles(event)) return;

          dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
          if (dragDepthRef.current === 0) setIsDragging(false);
        }}
        onDragOver={event => {
          if (!carriesFiles(event)) return;

          event.preventDefault();
          event.dataTransfer.dropEffect = isInteractive ? "copy" : "none";
        }}
        onDrop={event => {
          event.preventDefault();
          endDrag();
          pick(event.dataTransfer.files);
        }}
      >
        {pending ? (
          <>
            <LoaderCircleIcon
              aria-hidden
              className="text-muted-foreground size-5 animate-spin motion-reduce:animate-none"
            />
            <span className="text-muted-foreground text-sm">
              {t("uploading")}
            </span>
            {progress !== null && (
              <div className="w-full max-w-xs">
                <UploadProgress label={t("uploading")} progress={progress} />
              </div>
            )}
            {!!onCancel && (
              <Button
                onClick={event => {
                  event.stopPropagation();
                  onCancel();
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                {t("cancel_upload")}
              </Button>
            )}
          </>
        ) : (
          <>
            <UploadIcon aria-hidden className="text-muted-foreground size-5" />
            <span className="text-muted-foreground text-sm text-balance">
              {disabled ? disabledLabel : promptLabel}
            </span>
            <Button
              disabled={disabled}
              size="sm"
              type="button"
              variant="outline"
            >
              {t(multiple ? "choose_many" : "choose")}
            </Button>
          </>
        )}
      </div>
    </>
  );
};

const FileCardLeading = ({ children }: { children?: React.ReactNode }) => (
  <div
    className="flex shrink-0 items-center self-center"
    data-slot="attachment-leading"
  >
    {children}
  </div>
);

export const FileCard = ({
  children,
  file,
  leading,
  state = "done",
}: {
  children?: React.ReactNode;
  file: AutoFormFileValue;
  leading?: React.ReactNode;
  state?: "done" | "error" | "idle" | "uploading";
}) => (
  <Attachment className="w-full" state={state}>
    {!!leading && <FileCardLeading>{leading}</FileCardLeading>}
    <AttachmentMedia variant={isImageFile(file) ? "image" : "icon"}>
      {isImageFile(file) ? (
        <img alt="" decoding="async" loading="lazy" src={file.url} />
      ) : (
        <FileIcon />
      )}
    </AttachmentMedia>
    <AttachmentContent>
      <AttachmentTitle>{file.name}</AttachmentTitle>
      {file.size > 0 && (
        <AttachmentDescription>{formatBytes(file.size)}</AttachmentDescription>
      )}
    </AttachmentContent>
    {!!children && <AttachmentActions>{children}</AttachmentActions>}
  </Attachment>
);

export const FileCardSkeleton = ({
  leading,
  name,
  onCancel,
  progress = null,
  size,
}: {
  leading?: React.ReactNode;
  name: string;
  onCancel?: () => void;
  progress?: null | number;
  size: number;
}) => {
  const t = useTranslations("core.global.file");

  return (
    <Attachment className="w-full" state="uploading">
      {!!leading && <FileCardLeading>{leading}</FileCardLeading>}
      <AttachmentMedia variant="image">
        <Skeleton className="size-full rounded-none" />
      </AttachmentMedia>
      <AttachmentContent className="flex flex-col gap-1">
        <AttachmentTitle>{name}</AttachmentTitle>
        <AttachmentDescription className="mt-0">
          {t("uploading")} · {formatBytes(size)}
        </AttachmentDescription>
        {progress !== null && (
          <UploadProgress
            label={t("upload_progress_named", { name })}
            progress={progress}
          />
        )}
      </AttachmentContent>
      <AttachmentActions className="gap-1">
        {progress === null && (
          <Spinner aria-label={t("uploading")} className="mx-1.5" />
        )}
        {!!onCancel && (
          <AttachmentAction
            aria-label={t("cancel_upload_named", { name })}
            onClick={onCancel}
            type="button"
          >
            <XIcon />
          </AttachmentAction>
        )}
      </AttachmentActions>
    </Attachment>
  );
};

export const FileCardFailed = ({
  leading,
  message,
  name,
  onDismiss,
  onRetry,
}: {
  leading?: React.ReactNode;
  message: string;
  name: string;
  onDismiss: () => void;
  onRetry: () => void;
}) => {
  const t = useTranslations("core.global.file");

  return (
    <Attachment className="w-full" state="error">
      {!!leading && <FileCardLeading>{leading}</FileCardLeading>}
      <AttachmentMedia>
        <TriangleAlertIcon aria-hidden />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>{name}</AttachmentTitle>
        <AttachmentDescription
          className="leading-relaxed text-pretty whitespace-normal"
          role="alert"
        >
          {message}
        </AttachmentDescription>
      </AttachmentContent>
      <AttachmentActions className="gap-1">
        <AttachmentAction
          aria-label={t("retry_named", { name })}
          onClick={onRetry}
          type="button"
        >
          <RotateCcwIcon />
        </AttachmentAction>
        <AttachmentAction
          aria-label={t("dismiss_named", { name })}
          onClick={onDismiss}
          type="button"
        >
          <XIcon />
        </AttachmentAction>
      </AttachmentActions>
    </Attachment>
  );
};

export const FileError = ({
  action,
  children,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div className="flex flex-wrap items-center gap-2" data-slot="file-error">
    <p
      className="text-destructive flex flex-1 items-start gap-1.5 text-sm"
      role="alert"
    >
      <TriangleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
    {action}
  </div>
);
