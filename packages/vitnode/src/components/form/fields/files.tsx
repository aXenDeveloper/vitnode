"use client";

import { useMutation } from "@tanstack/react-query";
import { XIcon } from "lucide-react";
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
  FileCardSkeleton,
  FileConstraintsLine,
  FileDropzone,
  FileError,
  useUploadFailureMessage,
} from "./file-shared";

export interface AutoFormFilesProps extends ItemAutoFormComponentProps {
  /**
   * Accepted extensions, lowercase with a leading dot. Display and `accept` only
   * - whoever owns `onUpload` is what actually enforces them.
   */
  allowedExtensions?: readonly string[];
  allowedMimeTypes?: readonly string[];
  /** What the field currently holds, on an edit form, in stored order. */
  files?: AutoFormFileValue[];
  label?: React.ReactNode;
  /**
   * The per-**file** ceiling, in bytes.
   *
   * Per file and not for the list, deliberately: ten images are ten uploads, and
   * a shared budget would make the tenth pick fail for a reason the ninth
   * created. The API applies the same rule the same way.
   */
  maxBytes: number;
  /** The most files the field will hold. The picker stops offering at this. */
  maxItems: number;
  /** The fewest files the field accepts. Only used to guard the remove button. */
  minItems?: number;
  /**
   * Sends one file somewhere and comes back with its descriptor.
   *
   * One file per call, however many were chosen: each upload gets its own
   * request, its own outcome and its own error, so nine good images are stored
   * and the tenth says why it was refused.
   */
  onUpload: (file: File) => Promise<AutoFormFileValue>;
}

/**
 * One queued upload, so the list can show what is still in flight.
 *
 * The name and the size come off the local `File`, which means an in-flight card
 * shows both before the server has said anything - the skeleton is only for the
 * thumbnail, which genuinely does not exist yet.
 */
interface PendingUpload {
  key: number;
  name: string;
  size: number;
}

/**
 * A multi-file uploader for `AutoForm`.
 *
 * The form's value is the list of stored **identifiers**, in the order shown -
 * never the bytes, and never a nested object. That is exactly what the surrounding
 * JSON mutation sends, so a gallery of twelve photographs is twelve numbers in
 * the payload.
 *
 * Two decisions are worth stating, because both are about what a person can
 * recover from:
 *
 * - **Each file uploads on its own.** A selection of ten becomes ten concurrent
 *   requests, and one refusal does not discard the other nine. The failures are
 *   listed by file name rather than collapsed into "the upload failed", because
 *   "photo-7.tiff is not an accepted format" is the only version somebody can
 *   act on.
 * - **The list is append-only until the person removes something.** A second
 *   selection adds to what is there rather than replacing it, which is what
 *   "choose files" does everywhere else - and it is why the ceiling is enforced
 *   here, at pick time, instead of by a save that fails after the bandwidth is
 *   already spent.
 *
 * The stored order is the order files were **added**, and there are no reorder
 * controls: dragging an image to the front and dragging it back is not an edit
 * anybody wants to spend a version on. To rearrange, remove and re-add.
 */
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
  const [files, setFiles] = React.useState<AutoFormFileValue[]>(
    initialFiles ?? [],
  );
  const [pending, setPending] = React.useState<PendingUpload[]>([]);
  const [rejections, setRejections] = React.useState<string[]>([]);
  // Monotonic, so a queued upload that finished and another that starts with the
  // same name never share a React key.
  const nextKeyRef = React.useRef(0);

  // One object, read by all three: the constraint line, the `accept` attribute
  // and the pre-flight check. It is the same shape the server validates against,
  // which is why the UI cannot advertise a rule the API does not enforce.
  const constraints = { allowedExtensions, allowedMimeTypes, maxBytes };
  const formats = fileFormatLabels(constraints);
  const accept = fileAcceptAttribute(constraints);

  /**
   * The list as it stands, readable synchronously.
   *
   * A ref beside the state, because several uploads land independently and each
   * one has to append to what the *others* already added. Reading `files` from a
   * closure would give the last one to settle a view of the list from before the
   * first one did, and it would win.
   */
  const filesRef = React.useRef(files);

  /**
   * Commits a new list to the ref, the local state and the form.
   *
   * One function rather than three calls at every site, because they must never
   * disagree: the cards are rendered from the state and the payload is built
   * from `field.value`, and a place that updated only one of them would show a
   * gallery that saves as something else.
   */
  const commit = (next: AutoFormFileValue[]) => {
    filesRef.current = next;
    setFiles(next);
    field.onChange(next.map(file => file.id));
  };

  const upload = useMutation({
    mutationFn: async ({ file }: { file: File; key: number }) =>
      await onUpload(file),
    // No retry: an upload is not idempotent from the person's point of view -
    // a silent second attempt spends their bandwidth again and can leave two
    // stored objects where they asked for one.
    retry: false,
    onSettled: (_data, _error, variables) => {
      setPending(current =>
        current.filter(entry => entry.key !== variables.key),
      );
    },
    onSuccess: uploaded => {
      // Already there - a file the person picked twice in two selections. The API
      // would refuse the duplicate anyway; not adding it is the quieter and more
      // honest answer.
      if (filesRef.current.some(file => file.id === uploaded.id)) return;

      commit([...filesRef.current, uploaded]);
    },
    onError: (error, variables) => {
      const message = failureMessage({
        attempted: variables.file,
        error,
        formats,
        maxBytes,
      });
      if (message === null) return;

      // Prefixed with the file name, because a selection of ten produces up to
      // ten of these and an unattributed sentence names none of them.
      setRejections(current => [
        ...current,
        t("errors.named", { message, name: variables.file.name }),
      ]);
    },
  });

  const remaining = maxItems - files.length - pending.length;

  const pick = (chosen: File[]) => {
    setRejections([]);

    const accepted: File[] = [];
    const refused: string[] = [];

    for (const file of chosen) {
      if (accepted.length >= remaining) {
        refused.push(t("errors.too_many", { max: maxItems, name: file.name }));
        continue;
      }

      // A courtesy, not a check: the server runs the same three rules again and
      // is the one that decides. It exists so picking a 40 MB video for a 5 MB
      // field costs nothing instead of costing the upload - and it is the *same*
      // function, so it cannot disagree about what would have been refused.
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

    const queued = accepted.map(file => ({
      file,
      key: nextKeyRef.current++,
    }));
    if (queued.length === 0) return;

    setPending(current => [
      ...current,
      ...queued.map(entry => ({
        key: entry.key,
        name: entry.file.name,
        size: entry.file.size,
      })),
    ]);
    // Concurrently, and one request each: the whole reason each file has its own
    // outcome rather than the selection having one.
    for (const entry of queued) upload.mutate(entry);
  };

  const remove = (id: number) => {
    setRejections([]);
    commit(filesRef.current.filter(file => file.id !== id));
  };

  const state =
    pending.length > 0
      ? "uploading"
      : rejections.length > 0
        ? "error"
        : files.length > 0
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
        count={{ max: maxItems, used: files.length }}
        maxBytes={maxBytes}
      />

      <FormControl>
        <div className="flex flex-col gap-2">
          {files.length > 0 && (
            <ul className="flex flex-col gap-2" data-slot="file-list">
              {files.map(file => (
                <li key={file.id}>
                  <FileCard file={file}>
                    <AttachmentAction
                      aria-label={t("remove")}
                      // A field with `min: 2` cannot be taken to one by clicking:
                      // the save would be refused, and refusing the click says so
                      // before the bandwidth and the version are spent.
                      disabled={files.length <= minItems}
                      onClick={() => remove(file.id)}
                      type="button"
                    >
                      <XIcon />
                    </AttachmentAction>
                  </FileCard>
                </li>
              ))}
            </ul>
          )}

          {/*
            The in-flight files, one skeleton card each, in the order they were
            queued - and in the same list position they will settle into, so
            nothing shifts as they land. A single spinner would say "something is
            uploading" where a selection of ten needs to say which ones are left.
          */}
          {pending.length > 0 && (
            <ul className="flex flex-col gap-2" data-slot="file-pending">
              {pending.map(entry => (
                <li key={entry.key}>
                  <FileCardSkeleton name={entry.name} size={entry.size} />
                </li>
              ))}
            </ul>
          )}

          <FileDropzone
            accept={accept}
            disabled={remaining <= 0}
            disabledLabel={t("full", { max: maxItems })}
            multiple
            onPick={pick}
            // The zone itself never spins: the pending cards above already say
            // which files are in flight, and a spinner over the picker would stop
            // somebody adding an eleventh while the first ten upload.
            pending={false}
            promptLabel={t("drop_many")}
            state={state}
          />

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
