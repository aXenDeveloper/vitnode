"use client";

import {
  FileIcon,
  LoaderCircleIcon,
  TriangleAlertIcon,
  UploadIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import React from "react";

import type { FileRejectionReason } from "@/lib/file-constraints";

import {
  Attachment,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { fileFormatLabels } from "@/lib/file-constraints";
import { formatBytes } from "@/lib/format-bytes";
import { cn } from "@/lib/utils";

/**
 * The pieces `AutoFormFile` and `AutoFormFiles` both need.
 *
 * Its own module rather than one component with a `multiple` branch, because the
 * two differ in almost everything that matters - one value or a list, replace or
 * append, one failure or one per file - and almost nothing that is visible.
 * Sharing the *visible* half is what keeps a gallery entry and a cover image
 * looking like the same product, and keeps the constraint line, the `accept`
 * filter and the pre-flight check reading one descriptor rather than two copies
 * of one.
 */

/**
 * A stored file, as these inputs need to describe one.
 *
 * Declared here rather than imported from the Content Engine on purpose: this is
 * generic AutoForm infrastructure, and a form field that reached into
 * `@/content` for a type would make every hand-written form depend on the
 * Content Engine to upload a file. The Content Engine's own
 * `ContentFileDescriptor` is structurally this, so it passes straight in.
 */
export interface AutoFormFileValue {
  height?: number;
  id: number;
  mimeType?: null | string;
  name: string;
  size: number;
  url: string;
  width?: number;
}

/**
 * An upload failure that knows which rule refused it.
 *
 * A structural check rather than an `instanceof`: whoever owns `onUpload` builds
 * the error, and these components must not have to know about their error class
 * to read the one field they can act on.
 */
export const fileRejectionReasonOf = (
  error: unknown,
): FileRejectionReason | undefined => {
  const reason = (error as null | { reason?: unknown })?.reason;

  return reason === "extension" || reason === "mimeType" || reason === "size"
    ? reason
    : undefined;
};

export const isImageFile = (file: AutoFormFileValue): boolean =>
  (file.mimeType ?? "").startsWith("image/");

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

/**
 * The identifiers a form value names, whatever its arity.
 *
 * `null`, `undefined`, `""` and a list with rubbish in it all reduce to the ids
 * that are actually there - a file control's value is only ever an identifier or
 * a list of them, and everything else is a form that has not been filled in.
 */
export const fileIdsOfFormValue = (value: unknown): number[] => {
  if (Array.isArray(value)) {
    return value.map(asFileId).filter((id): id is number => id !== null);
  }

  const id = asFileId(value);

  return id === null ? [] : [id];
};

/**
 * What a file control should show, derived **entirely** from the form value.
 *
 * This is the rule that keeps a file control honest, and it used to be broken:
 * the previous version held the chosen file in local state, so pressing Remove
 * and then abandoning the form - closing the dialog, navigating away, letting a
 * refresh replace the row - left the control showing an empty drop zone for a
 * record whose column still held the file. The value said one thing and the
 * screen said another, and the screen is what somebody acts on.
 *
 * So the value decides, and the descriptors are only a **lookup**: they come
 * from the row the form opened on plus whatever this session uploaded, and they
 * are never removed. Restoring the value therefore restores the preview, without
 * anything having to re-fetch or re-sync.
 *
 * `file` is `null` when the value names an identifier nothing has a descriptor
 * for. The caller still renders a card for it, because "there is a file here and
 * I cannot describe it" and "there is no file here" must not look the same - the
 * second one invites an editor to replace something they cannot see.
 *
 * Order follows the **value**, not the lookup: for a gallery the value is the
 * stored order, and sorting by anything else would show a different gallery from
 * the one that would be saved.
 */
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

/**
 * What went wrong with one upload, in the most specific words available.
 *
 * A hook rather than a plain function only so the translator lives here: both
 * callers need the same three sentences, and `useTranslations` is what types the
 * keys.
 *
 * The server's own message is the **last** resort and also the most important
 * one. "Storage provider not found" and "Invalid or corrupt image file" are
 * exactly what somebody needs to read, and replacing either with "the upload
 * failed, please try again" is how an editor ends up retrying a misconfiguration
 * for ten minutes. The two rules above it are restated locally only because the
 * browser can say them in the reader's own language, using the field's own
 * limits and the file they actually picked.
 */
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

export const FileDropzone = ({
  accept,
  disabled,
  disabledLabel,
  multiple = false,
  onPick,
  pending,
  promptLabel,
  state,
}: {
  accept?: string;
  disabled?: boolean;
  disabledLabel?: string;
  multiple?: boolean;
  onPick: (files: File[]) => void;
  pending: boolean;
  promptLabel: string;
  state: "done" | "error" | "idle" | "uploading";
}) => {
  const t = useTranslations("core.global.file");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const pick = (list: FileList | null) => {
    if (disabled) return;

    const files = [...(list ?? [])];
    if (files.length > 0) onPick(files);
  };

  return (
    <div
      className={cn(
        "border-input flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center transition-colors",
        isDragging && "border-primary bg-primary/5",
        state === "error" && "border-destructive/40",
        disabled && "opacity-60",
      )}
      data-slot="file-dropzone"
      onDragLeave={event => {
        event.preventDefault();
        setIsDragging(false);
      }}
      onDragOver={event => {
        event.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDrop={event => {
        event.preventDefault();
        setIsDragging(false);
        pick(event.dataTransfer.files);
      }}
    >
      <input
        accept={accept}
        className="hidden"
        disabled={disabled}
        multiple={multiple}
        onChange={event => {
          pick(event.target.files);
          event.target.value = "";
        }}
        ref={inputRef}
        tabIndex={-1}
        type="file"
      />

      {pending ? (
        <>
          <LoaderCircleIcon
            aria-hidden
            className="text-muted-foreground size-5 animate-spin"
          />
          <span className="text-muted-foreground text-sm">
            {t("uploading")}
          </span>
        </>
      ) : (
        <>
          <UploadIcon aria-hidden className="text-muted-foreground size-5" />
          <span className="text-muted-foreground text-sm">
            {disabled ? disabledLabel : promptLabel}
          </span>
          <Button
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            size="sm"
            type="button"
            variant="outline"
          >
            {t(multiple ? "choose_many" : "choose")}
          </Button>
        </>
      )}
    </div>
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
      {isImageFile(file) ? <img alt="" src={file.url} /> : <FileIcon />}
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
  size,
}: {
  leading?: React.ReactNode;
  name: string;
  size: number;
}) => {
  const t = useTranslations("core.global.file");

  return (
    <Attachment className="w-full" state="uploading">
      {!!leading && <FileCardLeading>{leading}</FileCardLeading>}
      <AttachmentMedia variant="image">
        <Skeleton className="size-full rounded-none" />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>{name}</AttachmentTitle>
        <AttachmentDescription>
          {t("uploading")} · {formatBytes(size)}
        </AttachmentDescription>
      </AttachmentContent>
      <AttachmentActions>
        <Spinner aria-label={t("uploading")} className="mx-1.5" />
      </AttachmentActions>
    </Attachment>
  );
};

export const FileError = ({ children }: { children: React.ReactNode }) => (
  <p
    className="text-destructive flex items-start gap-1.5 text-sm"
    data-slot="file-error"
    role="alert"
  >
    <TriangleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
    <span>{children}</span>
  </p>
);
