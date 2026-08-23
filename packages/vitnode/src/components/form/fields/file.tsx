"use client";

import { useMutation } from "@tanstack/react-query";
import { RotateCcwIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import React from "react";

import { AttachmentAction } from "@/components/ui/attachment";
import { FormControl, FormMessage } from "@/components/ui/form";
import {
  fileAcceptAttribute,
  fileFormatLabels,
  validateFile,
} from "@/lib/file-constraints";
import { formatBytes } from "@/lib/format-bytes";

import type { ItemAutoFormComponentProps } from "../auto-form";
import type { AutoFormFileValue } from "./file-shared";

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
 * A single-file uploader for `AutoForm`.
 *
 * The form's value is the stored file's **identifier**, never the bytes: the
 * upload is its own `multipart/form-data` request through `onUpload`, and what
 * lands in `field.value` is what the surrounding JSON mutation will send. So a
 * form holding an image is the same size as one holding a number.
 *
 * What it shows is derived from `field.value`, never held beside it: see
 * {@link resolveFormFiles}. That is what makes Remove-then-abandon behave - the
 * value goes back to the identifier the record still holds and the preview comes
 * back with it, because nothing was thrown away.
 *
 * For a field that holds several files, use `AutoFormFiles` - same descriptor,
 * same rules, a list instead of a value.
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
  const failureMessage = useUploadFailureMessage();
  const [rejected, setRejected] = React.useState<null | string>(null);
  /**
   * Everything this session has uploaded, kept for its descriptors alone.
   *
   * Append-only and never pruned: a file the person removed and then got back -
   * by abandoning the form, or by a save being rolled back - has to be
   * describable again, and re-fetching a name and a URL we already had would be
   * a request to learn something we were told.
   */
  const [uploaded, setUploaded] = React.useState<AutoFormFileValue[]>([]);

  // The value decides; `initialFile` and the uploads are only the lookup behind
  // it. `initialFile` is listed second so a re-upload of the same id wins.
  const [resolved] = resolveFormFiles(field.value, [initialFile, ...uploaded]);
  const file = resolved?.file ?? null;

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
    onSuccess: stored => {
      setUploaded(current => [...current, stored]);
      setRejected(null);
      field.onChange(stored.id);
    },
  });

  const errorMessage =
    rejected ??
    failureMessage({
      attempted: upload.variables,
      error: upload.error,
      formats,
      maxBytes,
    });

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
    // `null` rather than `undefined`: a nullable file column is blanked by
    // sending `null`, and `undefined` would be dropped from the payload and
    // leave the stored value in place.
    //
    // Nothing else is cleared. Removing is a change to the *form*, and it is
    // undone by whatever restores the form - so the descriptor stays in the
    // lookup above and the preview returns with the value.
    field.onChange(null);
  };

  const state = upload.isPending
    ? "uploading"
    : errorMessage !== null
      ? "error"
      : resolved
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
        maxBytes={maxBytes}
      />

      <FormControl>
        <div className="flex flex-col gap-2">
          {resolved && !upload.isPending ? (
            // A value with no descriptor still gets a card: "there is a file
            // here and I cannot describe it" must not look like "there is no
            // file here", which would invite replacing something unseen.
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
              onPick={files => pick(files[0])}
              pending={upload.isPending}
              promptLabel={t("drop")}
              state={state}
            />
          )}

          {errorMessage !== null && <FileError>{errorMessage}</FileError>}
        </div>
      </FormControl>

      {!!description && <AutoFormDesc>{description}</AutoFormDesc>}
      <FormMessage />
    </>
  );
};

/**
 * The "replace" button, which owns its own hidden input.
 *
 * Its own component because the card and the drop zone are never mounted at the
 * same time: one hidden input shared between them would be unmounted exactly
 * when the card needs it.
 */
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
