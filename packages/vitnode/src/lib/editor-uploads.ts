import { getFileExtension } from "./file-extension";
import { formatBytes } from "./format-bytes";

export const EDITOR_IMAGE_MIME_TYPES = [
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const EDITOR_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export const EDITOR_ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;

export const EDITOR_UPLOAD_FOLDER = "editor";

export const EDITOR_IMAGE_WRAPS = ["none", "left", "right"] as const;

export type EditorImageWrap = (typeof EDITOR_IMAGE_WRAPS)[number];

export const EDITOR_IMAGE_MIN_WIDTH = 10;

export const EDITOR_IMAGE_MAX_ALT_LENGTH = 500;

export type EditorAttachmentKind = "archive" | "pdf" | "slides" | "word";

const EDITOR_ATTACHMENT_TYPES: Readonly<
  Record<string, { extension: string; kind: EditorAttachmentKind }>
> = {
  "application/msword": { extension: ".doc", kind: "word" },
  "application/pdf": { extension: ".pdf", kind: "pdf" },
  "application/vnd.ms-powerpoint": { extension: ".ppt", kind: "slides" },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
    extension: ".pptx",
    kind: "slides",
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    extension: ".docx",
    kind: "word",
  },
  "application/x-zip-compressed": { extension: ".zip", kind: "archive" },
  "application/zip": { extension: ".zip", kind: "archive" },
};

export const EDITOR_ATTACHMENT_MIME_TYPES = Object.keys(
  EDITOR_ATTACHMENT_TYPES,
);

export const EDITOR_ATTACHMENT_ACCEPT = [
  ...new Set(
    Object.values(EDITOR_ATTACHMENT_TYPES).map(type => type.extension),
  ),
  ...EDITOR_ATTACHMENT_MIME_TYPES,
].join(",");

export type EditorUploadKind = "attachment" | "image";

export interface EditorUploadResult {
  height: null | number;
  id: number;
  kind: EditorUploadKind;
  mimeType: null | string;
  name: string;
  size: number;
  url: string;
  width: null | number;
}

export const editorAttachmentMeta = ({
  name,
  size,
}: {
  name: string;
  size: null | number;
}): string =>
  [
    getFileExtension(name).slice(1).toUpperCase(),
    size === null ? "" : formatBytes(size),
  ]
    .filter(Boolean)
    .join(" · ");

export const isEditorImageMimeType = (type: string): boolean =>
  (EDITOR_IMAGE_MIME_TYPES as readonly string[]).includes(type);

export const editorAttachmentKindOf = (
  mimeType: unknown,
): EditorAttachmentKind | null =>
  typeof mimeType === "string"
    ? (EDITOR_ATTACHMENT_TYPES[mimeType]?.kind ?? null)
    : null;

export const isEditorAttachment = ({
  name,
  type,
}: {
  name: string;
  type: string;
}): boolean =>
  EDITOR_ATTACHMENT_TYPES[type]?.extension === getFileExtension(name);

export const editorAttachmentMimeTypeFor = (name: string): null | string => {
  const extension = getFileExtension(name);
  const match = Object.entries(EDITOR_ATTACHMENT_TYPES).find(
    ([, type]) => type.extension === extension,
  );

  return match?.[0] ?? null;
};

export const isEditorImageWrap = (value: unknown): value is EditorImageWrap =>
  typeof value === "string" &&
  (EDITOR_IMAGE_WRAPS as readonly string[]).includes(value);

export const normalizeEditorImageWidth = (value: unknown): null | number => {
  const width =
    typeof value === "string" ? Number.parseFloat(value) : Number(value);
  if (value === null || !Number.isFinite(width)) return null;

  const rounded = Math.round(width);
  if (rounded >= 100) return null;

  return Math.max(EDITOR_IMAGE_MIN_WIDTH, rounded);
};

export const editorPositiveIntegerOf = (
  value: null | string,
): null | number => {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const isRemoteEditorImageUrl = (value: string): boolean => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};
