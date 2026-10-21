import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import type { EnvVitNode } from "@/api/middlewares/global.middleware";

import {
  EDITOR_ATTACHMENT_MAX_BYTES,
  EDITOR_ATTACHMENT_MIME_TYPES,
  EDITOR_IMAGE_MAX_BYTES,
  EDITOR_IMAGE_MIME_TYPES,
  EDITOR_UPLOAD_FOLDER,
  editorAttachmentKindOf,
  type EditorUploadResult,
  isEditorAttachment,
  isEditorImageMimeType,
} from "@/lib/editor-uploads";

const zodEditorUploadForm = z.object({
  file: z.instanceof(File).openapi({ format: "binary", type: "string" }),
});

const zodEditorUploadResult = z.object({
  height: z.number().nullable(),
  id: z.number(),
  kind: z.enum(["attachment", "image"]),
  mimeType: z.string().nullable(),
  name: z.string(),
  size: z.number(),
  url: z.string(),
  width: z.number().nullable(),
});

const zodEditorUploadRejection = z.object({ error: z.string() });

export const editorUploadRequest = {
  body: {
    required: true,
    content: { "multipart/form-data": { schema: zodEditorUploadForm } },
  },
};

export const editorUploadResponses = {
  200: {
    content: { "application/json": { schema: zodEditorUploadResult } },
    description: "File stored in core_files",
  },
  400: {
    content: { "application/json": { schema: zodEditorUploadRejection } },
    description: "Not a file the editor accepts, or too large",
  },
};

const SIGNATURES: Record<string, readonly (readonly number[])[]> = {
  archive: [
    [0x50, 0x4b, 0x03, 0x04],
    [0x50, 0x4b, 0x05, 0x06],
  ],
  legacyOffice: [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]],
  pdf: [[0x25, 0x50, 0x44, 0x46, 0x2d]],
};

const signaturesFor = (mimeType: string): readonly (readonly number[])[] => {
  if (mimeType === "application/pdf") return SIGNATURES.pdf;
  if (
    mimeType === "application/msword" ||
    mimeType === "application/vnd.ms-powerpoint"
  ) {
    return SIGNATURES.legacyOffice;
  }

  return SIGNATURES.archive;
};

const hasAttachmentSignature = async (file: File): Promise<boolean> => {
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());

  return signaturesFor(file.type).some(signature =>
    signature.every((byte, index) => head[index] === byte),
  );
};

type EditorUploadOutcome =
  | { error: string; status: 400 }
  | { result: EditorUploadResult; status: 200 };

const rejected = (error: string): EditorUploadOutcome => ({
  error,
  status: 400,
});

/**
 * Stores one file dropped, pasted or inserted into an editor in `core_files`
 * and emits `file.editor.uploaded`. Images are always accepted;
 * attachments (PDF, Word, PowerPoint, ZIP) only with `attachments`, and only
 * when the extension and the file's first bytes match the declared type.
 */
export const storeEditorUpload = async (
  c: Context<EnvVitNode>,
  {
    attachments,
    file,
    userId,
  }: { attachments: boolean; file: File; userId: number },
): Promise<EditorUploadOutcome> => {
  const isImage = isEditorImageMimeType(file.type);
  const isAttachment =
    attachments && editorAttachmentKindOf(file.type) !== null;

  if (!isImage && !isAttachment) {
    return rejected(
      `"${file.type || "unknown"}" is not a file type this editor accepts.`,
    );
  }

  if (isAttachment) {
    if (!isEditorAttachment(file)) {
      return rejected(
        `"${file.name}" does not have the extension its type "${file.type}" needs.`,
      );
    }
    if (!(await hasAttachmentSignature(file))) {
      return rejected(`"${file.name}" is not a valid ${file.type} file.`);
    }
  }

  try {
    const stored = await c.get("storage").upload({
      allowedMimeTypes: isImage
        ? [...EDITOR_IMAGE_MIME_TYPES]
        : EDITOR_ATTACHMENT_MIME_TYPES,
      file,
      folder: EDITOR_UPLOAD_FOLDER,
      maxBytes: isImage ? EDITOR_IMAGE_MAX_BYTES : EDITOR_ATTACHMENT_MAX_BYTES,
      metadata: { source: "editor" },
      userId,
    });
    const kind = isImage ? "image" : "attachment";

    await c
      .get("events")
      .emit("file.editor.uploaded", { fileId: stored.id, kind, userId });

    return {
      result: {
        height: stored.dimensions?.height ?? null,
        id: stored.id,
        kind,
        mimeType: stored.mimeType,
        name: stored.name,
        size: stored.size,
        url: stored.url,
        width: stored.dimensions?.width ?? null,
      },
      status: 200,
    };
  } catch (error) {
    if (error instanceof HTTPException && error.status === 400) {
      return rejected(error.message);
    }

    throw error;
  }
};
