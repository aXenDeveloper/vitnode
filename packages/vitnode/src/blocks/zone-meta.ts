import type {
  BlockAllowedSpec,
  ContentZoneDefinition,
  ParsedContentZoneId,
} from "./types";

import {
  BLOCK_WILDCARD,
  CONTENT_ZONE_ALLOWED_ATTRIBUTE,
  CONTENT_ZONE_ATTRIBUTE,
  CONTENT_ZONE_ID_MAX_LENGTH,
  CONTENT_ZONE_ID_PATTERN,
  CONTENT_ZONE_SEPARATOR,
} from "./const";
import { BlockError } from "./errors";

export const isContentZoneId = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length <= CONTENT_ZONE_ID_MAX_LENGTH &&
  CONTENT_ZONE_ID_PATTERN.test(value);

export const assertContentZoneId = (id: string): string => {
  if (isContentZoneId(id)) return id;

  throw new BlockError(
    `Content zone id ${JSON.stringify(id)} is not usable. A zone id is one or more \`:\`-separated segments of lowercase letters, digits and single hyphens, up to ${CONTENT_ZONE_ID_MAX_LENGTH} characters - "main", "before-profile", "settings:before-profile". It is written by you and stored by the editor, so it is never generated and never an array index.`,
  );
};

export const parseContentZoneId = (id: string): null | ParsedContentZoneId => {
  if (!isContentZoneId(id)) return null;

  const at = id.lastIndexOf(CONTENT_ZONE_SEPARATOR);
  if (at < 0) return { name: id, scope: undefined };

  return { name: id.slice(at + 1), scope: id.slice(0, at) };
};

export const formatBlockAllowed = (allowed: BlockAllowedSpec): string =>
  allowed === BLOCK_WILDCARD ? BLOCK_WILDCARD : allowed.join(",");

export const contentZoneAttributes = ({
  allowedBlocks,
  id,
}: ContentZoneDefinition): Record<string, string> => ({
  [CONTENT_ZONE_ATTRIBUTE]: assertContentZoneId(id),
  ...(allowedBlocks === undefined
    ? {}
    : { [CONTENT_ZONE_ALLOWED_ATTRIBUTE]: formatBlockAllowed(allowedBlocks) }),
});

export interface ContentZoneBounds {
  max: number | undefined;
  min: number | undefined;
}

const narrowed = (
  declared: number | undefined,
  explicit: number | undefined,
  tighter: (left: number, right: number) => number,
): number | undefined => {
  if (declared === undefined) return explicit;
  if (explicit === undefined) return declared;

  return tighter(declared, explicit);
};

const describeBounds = ({ max, min }: ContentZoneBounds): string => {
  const parts = [
    min === undefined ? undefined : `min ${min}`,
    max === undefined ? undefined : `max ${max}`,
  ].filter(part => part !== undefined);

  return parts.length === 0 ? "no bounds" : parts.join(", ");
};

export const contentZoneBounds = ({
  declared,
  explicit,
  id,
}: {
  declared: ContentZoneBounds | undefined;
  explicit: ContentZoneBounds;
  id: string;
}): ContentZoneBounds => {
  const min = narrowed(declared?.min, explicit.min, Math.max);
  const max = narrowed(declared?.max, explicit.max, Math.min);

  if (min !== undefined && max !== undefined && min > max) {
    throw new BlockError(
      `Content zone ${JSON.stringify(id)} would be edited with min ${min} and max ${max}, which no list of blocks could satisfy. The page declares ${declared === undefined ? "nothing" : describeBounds(declared)} and the \`<ContentZone>\` asks for ${describeBounds(explicit)}; a call site may narrow the page's bounds but never widen them, so the two are intersected. Change one of them so the min is not above the max.`,
    );
  }

  return { max, min };
};
