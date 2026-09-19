import type {
  BlockAllowedEntry,
  BlockAllowedSpec,
  ContentZoneDefinition,
  ParsedContentZoneId,
} from "./types";

import {
  BLOCK_WILDCARD,
  CONTENT_BLOCKS_ABSOLUTE_MAX,
  CONTENT_BLOCKS_DEFAULT_MAX,
  CONTENT_ZONE_ALLOWED_ATTRIBUTE,
  CONTENT_ZONE_ATTRIBUTE,
  CONTENT_ZONE_ID_MAX_LENGTH,
  CONTENT_ZONE_ID_PATTERN,
  CONTENT_ZONE_SEPARATOR,
} from "./const";
import { BlockError } from "./errors";
import { parseBlockId } from "./namespace";

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

export interface ResolvedContentZoneBounds {
  max: number;
  min: number | undefined;
}

export const assertContentZoneBounds = (
  id: string,
  { max, min }: ContentZoneBounds,
): void => {
  if (min !== undefined && (!Number.isInteger(min) || min < 0)) {
    throw new BlockError(
      `Content zone ${JSON.stringify(id)} is mounted with a min of ${min}. A min counts the blocks the zone has to hold, so it is a whole number that is zero or more - a fraction, a negative, NaN or Infinity is compared against a list length on every edit and could never mean anything.`,
    );
  }

  if (
    max !== undefined &&
    (!Number.isInteger(max) || max < 1 || max > CONTENT_BLOCKS_ABSOLUTE_MAX)
  ) {
    throw new BlockError(
      `Content zone ${JSON.stringify(id)} is mounted with a max of ${max}. A max counts the blocks the zone may hold, so it is a whole number between 1 and ${CONTENT_BLOCKS_ABSOLUTE_MAX} - that ceiling is what a stored zone can be read back through, and blocks the editor accepted above it could never be saved.`,
    );
  }
};

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
}): ResolvedContentZoneBounds => {
  assertContentZoneBounds(id, explicit);

  const min = narrowed(declared?.min, explicit.min, Math.max);
  const max =
    narrowed(
      declared === undefined
        ? undefined
        : (declared.max ?? CONTENT_BLOCKS_DEFAULT_MAX),
      explicit.max,
      Math.min,
    ) ?? CONTENT_BLOCKS_DEFAULT_MAX;

  if (min !== undefined && min > max) {
    throw new BlockError(
      `Content zone ${JSON.stringify(id)} would be edited with min ${min} and max ${max}, which no list of blocks could satisfy. The page declares ${declared === undefined ? "nothing" : describeBounds(declared)} and the \`<ContentZone>\` asks for ${describeBounds(explicit)}; a zone that names no max of its own holds ${CONTENT_BLOCKS_DEFAULT_MAX} blocks, the same number \`field.blocks()\` stores, and a call site may narrow those bounds but never widen them, so the two are intersected. Change one of them so the min is not above the max.`,
    );
  }

  return { max, min };
};

const narrowedEntry = (
  declared: BlockAllowedEntry,
  explicit: BlockAllowedEntry,
): BlockAllowedEntry | null => {
  if (declared === explicit) return declared;
  if (declared === BLOCK_WILDCARD) return explicit;
  if (explicit === BLOCK_WILDCARD) return declared;

  const left = parseBlockId(declared);
  const right = parseBlockId(explicit);

  if (left === null || left.namespace !== right?.namespace) return null;
  if (left.name === BLOCK_WILDCARD) return explicit;
  if (right.name === BLOCK_WILDCARD) return declared;

  return null;
};

export const contentZoneAllowed = ({
  declared,
  explicit,
  id,
}: {
  declared: BlockAllowedSpec | undefined;
  explicit: BlockAllowedSpec | undefined;
  id: string;
}): BlockAllowedSpec | undefined => {
  if (declared === undefined) return explicit;
  if (explicit === undefined || explicit === BLOCK_WILDCARD) return declared;
  if (declared === BLOCK_WILDCARD) return explicit;

  const entries: BlockAllowedEntry[] = [];

  for (const wanted of explicit) {
    for (const permitted of declared) {
      const narrowed = narrowedEntry(permitted, wanted);

      if (narrowed !== null && !entries.includes(narrowed)) {
        entries.push(narrowed);
      }
    }
  }

  if (entries.length === 0) {
    throw new BlockError(
      `Content zone ${JSON.stringify(id)} would be edited with no allowed blocks at all. The page allows ${formatBlockAllowed(declared)} and the \`<ContentZone>\` asks for ${formatBlockAllowed(explicit)}, which have nothing in common - a call site may narrow the page's allowlist but never widen it, so the two are intersected. Name a block the page already allows, or widen the page's own \`allowed\`.`,
    );
  }

  return entries;
};
