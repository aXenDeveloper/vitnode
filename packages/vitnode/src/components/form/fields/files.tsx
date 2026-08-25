"use client";

import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import React from "react";

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
  /**
   * Whether the order is the author's to choose.
   *
   * `field.file({ multiple: true })` defaults it to `true`, which is why this
   * does too: a gallery is read in the order it was built. Pass `false` for a
   * field the API stores by ascending `core_files.id`, and the drag handles go
   * away with it - a control that appears to set an order the save then
   * normalises is worse than no control.
   */
  ordered?: boolean;
}

/**
 * A multi-file uploader for `AutoForm`.
 *
 * The form's value is the list of stored **identifiers**, in the order shown -
 * never the bytes, and never a nested object. That is exactly what the surrounding
 * JSON mutation sends, so a gallery of twelve photographs is twelve numbers in
 * the payload.
 *
 * Three decisions are worth stating, because all three are about what a person
 * can recover from:
 *
 * - **Each file uploads on its own.** A selection of ten becomes ten requests,
 *   at most `FILE_UPLOAD_CONCURRENCY` of them at a time, and one refusal
 *   does not discard the other nine. The failures are listed by file name rather
 *   than collapsed into "the upload failed", because "photo-7.tiff is not an
 *   accepted format" is the only version somebody can act on.
 * - **The order is the order they were picked**, not the order they arrived.
 *   Uploads finish out of order - a thumbnail beats a photograph however they
 *   were listed - so each one is queued with a slot that decides where it lands
 *   whenever it lands. See {@link createFileUploadQueue}.
 * - **The list is append-only until the person moves or removes something.** A
 *   second selection adds to what is there rather than replacing it, which is
 *   what "choose files" does everywhere else - and it is why the ceiling is
 *   enforced here, at pick time, instead of by a save that fails after the
 *   bandwidth is already spent.
 *
 * What it shows is derived from `field.value`, never held beside it: see
 * {@link resolveFormFiles}. That is what makes Remove-then-abandon behave, and it
 * is also what makes a drag a one-line change - the drop rewrites the value, and
 * the gallery follows it, so a form reset puts the old order back without a
 * reload.
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
  /**
   * Everything this session has uploaded, kept for its descriptors alone.
   *
   * Append-only and never pruned: a file the person removed and then got back -
   * by abandoning the form, or by a save being rolled back - has to be
   * describable again, and re-fetching a name and a URL we already had would be
   * a request to learn something we were told.
   */
  const [uploaded, setUploaded] = React.useState<AutoFormFileValue[]>([]);

  // One object, read by all three: the constraint line, the `accept` attribute
  // and the pre-flight check. It is the same shape the server validates against,
  // which is why the UI cannot advertise a rule the API does not enforce.
  const constraints = { allowedExtensions, allowedMimeTypes, maxBytes };
  const formats = fileFormatLabels(constraints);
  const accept = fileAcceptAttribute(constraints);

  // The value decides what is shown and in what order; the descriptors are only
  // the lookup behind it. So removing an entry - or dragging one - is a change to
  // the form and nothing else, and whatever restores the form restores the
  // gallery.
  const resolved = resolveFormFiles(field.value, [
    ...(initialFiles ?? []),
    ...uploaded,
  ]);
  const ids = resolved.map(entry => entry.id);

  /**
   * The identifiers as they stand, readable synchronously.
   *
   * A ref beside the derived value, because several uploads land independently
   * and each has to slot into what the *others* already added: reading the
   * render-time value from a closure would give the last one to settle a view of
   * the list from before the first one did, and it would win. Synced from the
   * form after every render, so an external reset is picked up too.
   */
  const idsRef = React.useRef<number[]>([]);
  React.useEffect(() => {
    idsRef.current = ids;
  });

  const commit = (next: readonly number[]) => {
    idsRef.current = [...next];
    field.onChange([...next]);
  };

  // One mutation, one file, one outcome - however many are chosen. Still a
  // `multipart/form-data` request per file and never a Server Action, and still
  // no retry: an upload is not idempotent from the person's point of view, so a
  // silent second attempt spends their bandwidth again and can leave two stored
  // objects where they asked for one.
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
      // Remembered whether or not it joins the list, because the descriptor is
      // worth having either way - a duplicate pick is still a file this session
      // now knows how to describe.
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

    // Prefixed with the file name, because a selection of ten produces up to ten
    // of these and an unattributed sentence names none of them.
    setRejections(current => [
      ...current,
      t("errors.named", { message, name: file.name }),
    ]);
  };

  /**
   * The collaborators the queue calls, always the current ones.
   *
   * The queue is built once and outlives every render - it has to, or a second
   * selection would start a second queue and the ceiling would mean nothing - so
   * it reaches its callbacks through a ref rather than closing over the first
   * render's copies of them.
   */
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

    // In pick order, bounded, one request each: the whole reason each file has
    // its own outcome rather than the selection having one.
    queue.enqueue(accepted);
  };

  const remove = (id: number) => {
    setRejections([]);
    // Only the value moves, and everything it does not name stays exactly where
    // it was. The descriptor stays in the lookup too, so an entry that comes back
    // - the form abandoned, a save rolled back - comes back described.
    commit(removeFileId(ids, id));
  };

  /*
    The rows to draw: the stored files, with each in-flight upload standing in
    the place it is going to land rather than at the bottom. So the skeleton is
    replaced by its card without the list rearranging itself under the cursor.
  */
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
