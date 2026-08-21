"use client";

import { useMutation } from "@tanstack/react-query";
import {
  FileIcon,
  LoaderCircleIcon,
  RotateCcwIcon,
  TriangleAlertIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import React from "react";

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
import { FormControl, FormMessage } from "@/components/ui/form";
import {
  fileAcceptAttribute,
  fileFormatLabels,
  validateFile,
} from "@/lib/file-constraints";
import { formatBytes } from "@/lib/format-bytes";
import { cn } from "@/lib/utils";

import type { ItemAutoFormComponentProps } from "../auto-form";

import { AutoFormDesc } from "../common/desc";
import { AutoFormLabel } from "../common/label";

/**
 * A stored file, as this input needs to describe one.
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

export interface AutoFormFileProps extends ItemAutoFormComponentProps {
  /**
   * Accepted extensions, lowercase with a leading dot. Display and `accept` only
   * - whoever owns `onUpload` is what actually enforces them.
   */
  allowedExtensions?: readonly string[];
  allowedMimeTypes?: readonly string[];
  /** What the field currently holds, on an edit form. */
  file?: AutoFormFileValue | null;
  label?: React.ReactNode;
  /**
   * The ceiling, in bytes. **Required**, because the line that shows it is not
   * optional: an uploader that does not say how big a file may be is one people
   * discover the limit of by failing.
   */
  maxBytes: number;
  /**
   * Sends one file somewhere and comes back with its descriptor.
   *
   * Injected rather than built in, which is what keeps this component generic:
   * the Content Engine passes its generated multipart route, and a hand-written
   * form passes whatever it has. Its rejection message is shown verbatim, so it
   * should be written for the person who picked the file.
   */
  onUpload: (file: File) => Promise<AutoFormFileValue>;
}

/**
 * An upload failure that knows which rule refused it.
 *
 * A structural check rather than an `instanceof`: whoever owns `onUpload` builds
 * the error, and this component must not have to know about their error class to
 * read the one field it can act on.
 */
const rejectionReasonOf = (error: unknown): FileRejectionReason | undefined => {
  const reason = (error as null | { reason?: unknown })?.reason;

  return reason === "extension" || reason === "mimeType" || reason === "size"
    ? reason
    : undefined;
};

const isImage = (file: AutoFormFileValue): boolean =>
  (file.mimeType ?? "").startsWith("image/");

/**
 * A single-file uploader for `AutoForm`.
 *
 * The form's value is the stored file's **identifier**, never the bytes: the
 * upload is its own `multipart/form-data` request through `onUpload`, and what
 * lands in `field.value` is what the surrounding JSON mutation will send. So a
 * form holding an image is the same size as one holding a number.
 *
 * The constraint line above the drop zone is **not conditional**. Allowed
 * formats and maximum size are shown whether or not anything has gone wrong,
 * because "5 MB" is information somebody needs *before* choosing a file - a
 * validation error that says it afterwards is a worse version of the same
 * sentence.
 */
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  multiLang,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  itemParams,
}: AutoFormFileProps) => {
  const t = useTranslations("core.global.file");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<AutoFormFileValue | null>(
    initialFile ?? null,
  );
  const [rejected, setRejected] = React.useState<null | string>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  // One object, read by all three: the constraint line, the `accept` attribute
  // and the pre-flight check. It is the same shape the server validates against,
  // which is why the UI cannot advertise a rule the API does not enforce.
  const constraints = { allowedExtensions, allowedMimeTypes, maxBytes };
  const formats = fileFormatLabels(constraints);
  const accept = fileAcceptAttribute(constraints);

  const upload = useMutation({
    mutationFn: onUpload,
    // No retry: an upload is not idempotent from the person's point of view -
    // a silent second attempt spends their bandwidth again and can leave two
    // stored objects where they asked for one.
    retry: false,
    onSuccess: uploaded => {
      setFile(uploaded);
      setRejected(null);
      field.onChange(uploaded.id);
    },
  });

  /**
   * What went wrong, in the most specific words available.
   *
   * Three sources, in order of how much they know:
   *
   * 1. `rejected` - the pre-flight check, already translated;
   * 2. a server rejection that named a rule this component can restate in the
   *    reader's own language, using the field's own limits and the file they
   *    actually picked;
   * 3. the server's own message, verbatim.
   *
   * The last one matters more than it looks. "Storage provider not found" and
   * "Invalid or corrupt image file" are exactly what somebody needs to read, and
   * replacing either with "the upload failed, please try again" is how an editor
   * ends up retrying a misconfiguration for ten minutes.
   */
  const errorMessage = React.useMemo(() => {
    if (rejected !== null) return rejected;
    if (!(upload.error instanceof Error)) return null;

    const reason = rejectionReasonOf(upload.error);
    const attempted = upload.variables;

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

    return upload.error.message;
  }, [formats, maxBytes, rejected, t, upload.error, upload.variables]);

  const pick = (chosen: File | undefined) => {
    if (!chosen) return;

    // A courtesy, not a check: the server runs the same three rules again and is
    // the one that decides. It exists so picking a 40 MB video for a 5 MB field
    // costs nothing instead of costing the upload - and it is the *same*
    // function, so it cannot disagree about what would have been refused.
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
              max: formatBytes(maxBytes),
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

  const remove = () => {
    upload.reset();
    setRejected(null);
    setFile(null);
    // `null` rather than `undefined`: a nullable file column is blanked by
    // sending `null`, and `undefined` would be dropped from the payload and
    // leave the stored value in place.
    field.onChange(null);
  };

  const openPicker = () => inputRef.current?.click();

  const state = upload.isPending
    ? "uploading"
    : errorMessage !== null
      ? "error"
      : file
        ? "done"
        : "idle";

  return (
    <>
      {!!label && (
        <AutoFormLabel isOptional={isOptional} labelRight={labelRight}>
          {label}
        </AutoFormLabel>
      )}

      {/*
        The constraints, always. Rendered above the control rather than as help
        text underneath it, because they are what somebody reads before they act.
      */}
      <div className="text-muted-foreground flex flex-col gap-0.5 text-xs">
        <span data-slot="file-formats">
          {formats.length > 0 ? formats.join(", ") : t("any_format")}
        </span>
        <span data-slot="file-max-size">
          {t("max_size", { size: formatBytes(maxBytes) })}
        </span>
      </div>

      <FormControl>
        <div className="flex flex-col gap-2">
          <input
            accept={accept}
            className="hidden"
            onChange={event => {
              pick(event.target.files?.[0]);
              // Cleared so choosing the same file twice still fires `change`.
              event.target.value = "";
            }}
            ref={inputRef}
            tabIndex={-1}
            type="file"
          />

          {file && !upload.isPending ? (
            <Attachment className="w-full" state={state}>
              <AttachmentMedia variant={isImage(file) ? "image" : "icon"}>
                {isImage(file) ? (
                  // Decorative: the file name is right beside it as real text.
                  <img alt="" src={file.url} />
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
                  aria-label={t("replace")}
                  onClick={openPicker}
                  type="button"
                >
                  <RotateCcwIcon />
                </AttachmentAction>
                <AttachmentAction
                  aria-label={t("remove")}
                  onClick={remove}
                  type="button"
                >
                  <XIcon />
                </AttachmentAction>
              </AttachmentActions>
            </Attachment>
          ) : (
            <div
              className={cn(
                "border-input flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center transition-colors",
                isDragging && "border-primary bg-primary/5",
                state === "error" && "border-destructive/40",
              )}
              data-slot="file-dropzone"
              onDragLeave={event => {
                event.preventDefault();
                setIsDragging(false);
              }}
              onDragOver={event => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDrop={event => {
                event.preventDefault();
                setIsDragging(false);
                pick(event.dataTransfer.files[0]);
              }}
            >
              {upload.isPending ? (
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
                  <UploadIcon
                    aria-hidden
                    className="text-muted-foreground size-5"
                  />
                  <span className="text-muted-foreground text-sm">
                    {t("drop")}
                  </span>
                  <Button
                    onClick={openPicker}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {t("choose")}
                  </Button>
                </>
              )}
            </div>
          )}

          {errorMessage !== null && (
            <p
              className="text-destructive flex items-start gap-1.5 text-sm"
              data-slot="file-error"
              role="alert"
            >
              <TriangleAlertIcon
                aria-hidden
                className="mt-0.5 size-4 shrink-0"
              />
              <span>{errorMessage}</span>
            </p>
          )}
        </div>
      </FormControl>

      {!!description && <AutoFormDesc>{description}</AutoFormDesc>}
      <FormMessage />
    </>
  );
};
