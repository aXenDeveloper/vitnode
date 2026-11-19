import type { EmojiIconValue } from "../../lib/emoji-icon";
import type {
  AnyContentContainerDefinition,
  ContentContainerIconField,
} from "./types";

import { parseEmojiIcon, serializeEmojiIcon } from "../../lib/emoji-icon";

/**
 * A container icon: an emoji, a Lucide icon, or an uploaded image addressed by
 * its public URL. Browser-safe.
 */
export type ContentContainerIconValue =
  | EmojiIconValue
  | { type: "image"; value: string };

export const CONTENT_CONTAINER_ICON_MAX_LENGTH = 1024;

export const CONTENT_CONTAINER_ICON_DEFAULT_MAX_BYTES = 1024 * 1024;

export const CONTENT_CONTAINER_ICON_MIME_TYPES = [
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

const IMAGE_SCHEME = "image:";

export const contentContainerIconFields = (
  definition: AnyContentContainerDefinition,
): [string, ContentContainerIconField][] =>
  Object.entries(definition.fields).flatMap(([name, fieldValue]) =>
    fieldValue.kind === "icon" ? [[name, fieldValue]] : [],
  );

const isIconImageUrl = (value: string): boolean => {
  if (value.startsWith("/")) return !value.startsWith("//");

  try {
    const url = new URL(value);

    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};

/**
 * Reads a stored icon: `emoji:🚀`, `icon:newspaper` or `image:<url>`. Returns
 * `undefined` for anything else, including an image URL that is neither
 * `http(s)` nor a same-origin path.
 */
export const parseContentContainerIcon = (
  raw: null | string | undefined,
): ContentContainerIconValue | undefined => {
  const trimmed = raw?.trim();
  if (!trimmed || trimmed.length > CONTENT_CONTAINER_ICON_MAX_LENGTH) {
    return undefined;
  }

  if (trimmed.startsWith(IMAGE_SCHEME)) {
    const url = trimmed.slice(IMAGE_SCHEME.length);

    return isIconImageUrl(url) ? { type: "image", value: url } : undefined;
  }

  return parseEmojiIcon(trimmed);
};

/** The stored string for an icon, or `""` for none. */
export const serializeContentContainerIcon = (
  value: ContentContainerIconValue | null | undefined,
): string => {
  if (!value) return "";
  if (value.type === "image") return `${IMAGE_SCHEME}${value.value}`;

  return serializeEmojiIcon(value);
};
