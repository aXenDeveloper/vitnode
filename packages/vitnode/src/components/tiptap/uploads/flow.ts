import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/react";

import { NodeSelection, Selection } from "@tiptap/pm/state";

import {
  EDITOR_ATTACHMENT_MAX_BYTES,
  EDITOR_IMAGE_MAX_ALT_LENGTH,
  EDITOR_IMAGE_MAX_BYTES,
  editorAttachmentMimeTypeFor,
  type EditorUploadResult,
  isEditorAttachment,
  isEditorImageMimeType,
  isRemoteEditorImageUrl,
} from "@/lib/editor-uploads";

import type { EditorUploadRuntime } from "./runtime";

export const EDITOR_IMAGE_NODE = "image";

export const EDITOR_ATTACHMENT_NODE = "attachment";

export const EDITOR_UPLOAD_NODES: ReadonlySet<string> = new Set([
  EDITOR_ATTACHMENT_NODE,
  EDITOR_IMAGE_NODE,
]);

const previews = new Map<string, string>();
const finished = new Map<string, EditorUploadResult>();

export const editorUploadPreview = (uploadId: null | string): null | string =>
  uploadId === null ? null : (previews.get(uploadId) ?? null);

export const finishedEditorUpload = (
  uploadId: null | string,
): EditorUploadResult | null =>
  uploadId === null ? null : (finished.get(uploadId) ?? null);

export const hasFinishedEditorUploads = (): boolean => finished.size > 0;

export const uploadedNodeAttrs = (
  result: EditorUploadResult,
): Record<string, null | number | string> =>
  result.kind === "image"
    ? {
        fileId: result.id,
        naturalHeight: result.height,
        naturalWidth: result.width,
        src: result.url,
        uploadId: null,
      }
    : {
        fileId: result.id,
        mimeType: result.mimeType,
        name: result.name,
        size: result.size,
        src: result.url,
        uploadId: null,
      };

const findUploadPos = (
  doc: ProseMirrorNode,
  uploadId: string,
): null | number => {
  let found: null | number = null;
  doc.descendants((node, pos) => {
    if (found !== null) return false;
    if (
      EDITOR_UPLOAD_NODES.has(node.type.name) &&
      node.attrs.uploadId === uploadId
    ) {
      found = pos;
    }

    return true;
  });

  return found;
};

const settleUpload = (
  editor: Editor,
  uploadId: string,
  attrs: null | Record<string, null | number | string>,
) => {
  if (editor.isDestroyed) return;

  const pos = findUploadPos(editor.state.doc, uploadId);
  if (pos === null) return;

  const node = editor.state.doc.nodeAt(pos);
  if (!node) return;

  const tr =
    attrs === null
      ? editor.state.tr.delete(pos, pos + node.nodeSize)
      : editor.state.tr.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          ...attrs,
        });

  editor.view.dispatch(tr.setMeta("addToHistory", false));
};

type PreparedFile =
  | { file: File; kind: "attachment" }
  | { file: File; kind: "image" };

const prepareFile = (
  runtime: EditorUploadRuntime,
  file: File,
): null | PreparedFile => {
  if (isEditorImageMimeType(file.type)) {
    if (file.size > EDITOR_IMAGE_MAX_BYTES) {
      runtime.onReject("too_large", file);

      return null;
    }

    return { file, kind: "image" };
  }

  const mimeType = isEditorAttachment(file)
    ? file.type
    : editorAttachmentMimeTypeFor(file.name);
  if (!runtime.attachments || mimeType === null) {
    runtime.onReject("type", file);

    return null;
  }

  if (file.size > EDITOR_ATTACHMENT_MAX_BYTES) {
    runtime.onReject("too_large", file);

    return null;
  }

  return {
    file:
      mimeType === file.type
        ? file
        : new File([file], file.name, { type: mimeType }),
    kind: "attachment",
  };
};

const startUpload = (
  editor: Editor,
  runtime: EditorUploadRuntime,
  {
    file,
    onFailure,
    uploadId,
  }: {
    file: File;
    onFailure: null | Record<string, null>;
    uploadId: string;
  },
) => {
  runtime
    .upload(file)
    .then(result => {
      finished.set(uploadId, result);
      settleUpload(editor, uploadId, uploadedNodeAttrs(result));
    })
    .catch((error: unknown) => {
      runtime.onReject(
        "upload",
        file,
        error instanceof Error ? error.message : undefined,
      );
      settleUpload(editor, uploadId, onFailure);
    })
    .finally(() => {
      const preview = previews.get(uploadId);
      previews.delete(uploadId);
      if (preview) URL.revokeObjectURL(preview);
    });
};

const moveCaretPastSelectedNode = (editor: Editor) => {
  const { selection } = editor.state;
  if (!(selection instanceof NodeSelection)) return;

  const after = Selection.near(editor.state.doc.resolve(selection.to), 1);
  editor.view.dispatch(editor.state.tr.setSelection(after));
};

const alignmentAt = (editor: Editor, pos?: number): null | string => {
  const $pos =
    pos === undefined
      ? editor.state.selection.$from
      : editor.state.doc.resolve(Math.min(pos, editor.state.doc.content.size));
  const textAlign: unknown = $pos.parent.attrs.textAlign;

  return typeof textAlign === "string" ? textAlign : null;
};

const nodeFor = (
  { file, kind }: PreparedFile,
  uploadId: string,
  textAlign: null | string,
) =>
  kind === "image"
    ? { attrs: { textAlign, uploadId }, type: EDITOR_IMAGE_NODE }
    : {
        attrs: {
          mimeType: file.type,
          name: file.name,
          size: file.size,
          uploadId,
        },
        type: EDITOR_ATTACHMENT_NODE,
      };

/**
 * Inserts a placeholder for each accepted file at `pos` (the selection when
 * omitted): an image node for images, an attachment card for documents and
 * archives. Uploads run in parallel; a failed one removes its placeholder and
 * reports through the runtime.
 */
export const insertEditorFiles = (
  editor: Editor,
  runtime: EditorUploadRuntime,
  files: File[],
  pos?: number,
): void => {
  const uploads = files.flatMap(file => {
    const prepared = prepareFile(runtime, file);
    if (!prepared) return [];

    const uploadId = crypto.randomUUID();
    if (prepared.kind === "image") {
      previews.set(uploadId, URL.createObjectURL(prepared.file));
    }

    return [{ prepared, uploadId }];
  });
  if (uploads.length === 0) return;

  const textAlign = alignmentAt(editor, pos);
  const content = uploads.map(({ prepared, uploadId }) =>
    nodeFor(prepared, uploadId, textAlign),
  );
  const chain = editor.chain().focus();
  if (pos === undefined) chain.insertContent(content).run();
  else chain.insertContentAt(pos, content).run();
  moveCaretPastSelectedNode(editor);

  for (const { prepared, uploadId } of uploads) {
    startUpload(editor, runtime, {
      file: prepared.file,
      onFailure: null,
      uploadId,
    });
  }
};

/** Uploads `file` and swaps it into the image at `pos`, keeping its settings. */
export const replaceEditorImageFile = (
  editor: Editor,
  runtime: EditorUploadRuntime,
  { file, pos }: { file: File; pos: number },
): void => {
  const node = editor.state.doc.nodeAt(pos);
  if (node?.type.name !== EDITOR_IMAGE_NODE) return;

  const prepared = prepareFile(runtime, file);
  if (prepared?.kind !== "image") {
    if (prepared) runtime.onReject("type", file);

    return;
  }

  const uploadId = crypto.randomUUID();
  previews.set(uploadId, URL.createObjectURL(file));
  editor.view.dispatch(
    editor.state.tr.setNodeMarkup(pos, undefined, {
      ...node.attrs,
      uploadId,
    }),
  );

  startUpload(editor, runtime, {
    file,
    onFailure: { uploadId: null },
    uploadId,
  });
};

/**
 * Inserts images and files that already live in `core_files` (or at an
 * `https://` address) without uploading anything, e.g. the ones another
 * language version of the document uses.
 */
export const insertReusedEditorUploads = (
  editor: Editor,
  uploads: { attrs: Record<string, unknown>; type: string }[],
): void => {
  if (uploads.length === 0) return;

  const textAlign = alignmentAt(editor);
  editor
    .chain()
    .focus()
    .insertContent(
      uploads.map(({ attrs, type }) => ({
        attrs:
          type === EDITOR_IMAGE_NODE
            ? { ...attrs, textAlign, uploadId: null }
            : { ...attrs, uploadId: null },
        type,
      })),
    )
    .run();
  moveCaretPastSelectedNode(editor);
};

/** Inserts an image by its `https://` address. */
export const insertRemoteEditorImage = (
  editor: Editor,
  { alt, src }: { alt: string; src: string },
): boolean => {
  if (!isRemoteEditorImageUrl(src)) return false;

  const inserted = editor
    .chain()
    .focus()
    .insertContent({
      attrs: {
        alt: alt.slice(0, EDITOR_IMAGE_MAX_ALT_LENGTH),
        src,
        textAlign: alignmentAt(editor),
      },
      type: EDITOR_IMAGE_NODE,
    })
    .run();
  moveCaretPastSelectedNode(editor);

  return inserted;
};
