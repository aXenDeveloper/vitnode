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
  resolveFormFiles,
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
 *
 * What it shows is derived from `field.value`, never held beside it: see
 * {@link resolveFormFiles}. That is what makes Remove-then-abandon behave - the
 * value goes back to the identifiers the record still holds and the cards come
 * back with it, because nothing was thrown away.
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
  const [pending, setPending] = React.useState<PendingUpload[]>([]);
  const [rejections, setRejections] = React.useState<string[]>([]);
  /**
   * Everything this session has uploaded, kept for its descriptors alone.
   *
   * Append-only and never pruned: a file the person removed and then got back -
   * by abandoning the form, or by a save being rolled back - has to be
   * describable again, and re-fetching a name and a URL we already had would be
   * a request to learn something we were told.
   */
  const [uploaded, setUploaded] = React.useState<AutoFormFileValue[]>([]);
  // Monotonic, so a queued upload that finished and another that starts with the
  // same name never share a React key.
  const nextKeyRef = React.useRef(0);

  // One object, read by all three: the constraint line, the `accept` attribute
  // and the pre-flight check. It is the same shape the server validates against,
  // which is why the UI cannot advertise a rule the API does not enforce.
  const constraints = { allowedExtensions, allowedMimeTypes, maxBytes };
  const formats = fileFormatLabels(constraints);
  const accept = fileAcceptAttribute(constraints);

  // The value decides what is shown and in what order; the descriptors are only
  // the lookup behind it. So removing an entry is a change to the form and
  // nothing else, and whatever restores the form restores the gallery.
  const resolved = resolveFormFiles(field.value, [
    ...(initialFiles ?? []),
    ...uploaded,
  ]);

  /**
   * The identifiers as they stand, readable synchronously.
   *
   * A ref beside the derived value, because several uploads land independently
   * and each has to append to what the *others* already added: reading the
   * render-time value from a closure would give the last one to settle a view of
   * the list from before the first one did, and it would win. Synced from the
   * form after every render, so an external reset is picked up too.
   */
  const idsRef = React.useRef<number[]>([]);
  const ids = resolved.map(entry => entry.id);
  React.useEffect(() => {
    idsRef.current = ids;
  });

  const commit = (next: readonly number[]) => {
    idsRef.current = [...next];
    field.onChange([...next]);
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
    onSuccess: stored => {
      // Remembered whether or not it joins the list, because the descriptor is
      // worth having either way - a duplicate pick is still a file this session
      // now knows how to describe.
      setUploaded(current => [...current, stored]);

      // Already in the list - a file the person picked twice in two selections.
      // The API would refuse the duplicate anyway; not adding it is the quieter
      // and more honest answer.
      if (idsRef.current.includes(stored.id)) return;

      commit([...idsRef.current, stored.id]);
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
    // Only the value moves. The descriptor stays in the lookup, so an entry that
    // comes back - the form abandoned, a save rolled back - comes back described.
    commit(ids.filter(current => current !== id));
  };

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
          {/*
            The picker leads and the files follow it, which is the order somebody
            uses them in: on an empty field there is nothing above the control to
            scroll past, and on a full one the button stays where it was instead
            of being pushed down the page by every file added to it.
          */}
          <FileDropzone
            accept={accept}
            disabled={remaining <= 0}
            disabledLabel={t("full", { max: maxItems })}
            multiple
            onPick={pick}
            // The zone itself never spins: the pending cards below already say
            // which files are in flight, and a spinner over the picker would stop
            // somebody adding an eleventh while the first ten upload.
            pending={false}
            promptLabel={t("drop_many")}
            state={state}
          />

          {resolved.length > 0 && (
            <ul className="flex flex-col gap-2" data-slot="file-list">
              {resolved.map(({ file, id }) => (
                <li key={id}>
                  {/*
                    An entry with no descriptor still gets a card: "there is a
                    file here and I cannot describe it" must not look like the
                    gallery being one shorter than it is.
                  */}
                  <FileCard
                    file={file ?? { id, name: t("stored"), size: 0, url: "" }}
                  >
                    <AttachmentAction
                      aria-label={t("remove")}
                      // A field with `min: 2` cannot be taken to one by clicking:
                      // the save would be refused, and refusing the click says so
                      // before the bandwidth and the version are spent.
                      disabled={ids.length <= minItems}
                      onClick={() => remove(id)}
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
            queued - and **after** the settled ones, which is where they will
            land, since an upload appends. So nothing shifts as they arrive: the
            skeleton is replaced in place by the card it was standing in for.
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
