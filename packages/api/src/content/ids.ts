import { z } from "zod";

import type { CONTENT_ID_STRATEGIES } from "./const";

import { CONTENT_ID_KEY_LENGTH } from "./const";
import { ContentEngineError } from "./errors";

export type ContentIdStrategy = (typeof CONTENT_ID_STRATEGIES)[number];

export type ContentIdOfStrategy<TStrategy> = TStrategy extends "serial"
  ? number
  : string;

export type ContentIdOf<TDefinition> = TDefinition extends {
  idStrategy: infer TStrategy;
}
  ? ContentIdOfStrategy<TStrategy>
  : number;

export type ContentId = number | string;

export const CONTENT_SERIAL_MAX = 2_147_483_647;

export const CONTENT_BIGINT_MAX = "9223372036854775807";

const SERIAL_PATTERN = /^[1-9][0-9]{0,9}$/;
const BIGINT_PATTERN = /^[1-9][0-9]{0,18}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const withinBigint = (value: string): boolean =>
  value.length < CONTENT_BIGINT_MAX.length ||
  (value.length === CONTENT_BIGINT_MAX.length && value <= CONTENT_BIGINT_MAX);

export const parseContentId = (
  strategy: ContentIdStrategy,
  value: unknown,
): ContentId | null => {
  if (strategy === "uuid") {
    return typeof value === "string" && UUID_PATTERN.test(value) ? value : null;
  }

  if (strategy === "bigint") {
    if (typeof value === "number") {
      return Number.isSafeInteger(value) && value > 0 ? String(value) : null;
    }
    if (typeof value === "bigint") {
      const text = value.toString();

      return value > 0n && withinBigint(text) ? text : null;
    }

    return typeof value === "string" &&
      BIGINT_PATTERN.test(value) &&
      withinBigint(value)
      ? value
      : null;
  }

  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 && value <= CONTENT_SERIAL_MAX
      ? value
      : null;
  }
  if (typeof value === "string" && SERIAL_PATTERN.test(value)) {
    const parsed = Number(value);

    return parsed <= CONTENT_SERIAL_MAX ? parsed : null;
  }

  return null;
};

/**
 * Validates an id from a request, a job payload or a URL against a content
 * type's `idStrategy`: a positive serial number, a bigint string or a UUID.
 * `null` when it is not one.
 */
export const parseContentIdOf = <
  TDefinition extends { idStrategy: ContentIdStrategy },
>(
  definition: TDefinition,
  value: unknown,
): ContentIdOf<TDefinition> | null =>
  parseContentId(
    definition.idStrategy,
    value,
  ) as ContentIdOf<TDefinition> | null;

export const contentIdKey = (id: ContentId): string => String(id);

export const contentIdFromKey = (
  strategy: ContentIdStrategy,
  key: string,
): ContentId | null => parseContentId(strategy, key);

export const isContentId = (
  strategy: ContentIdStrategy,
  value: unknown,
): value is ContentId => {
  const parsed = parseContentId(strategy, value);

  return parsed !== null && parsed === value;
};

export const contentIdSchema = (
  strategy: ContentIdStrategy,
): z.ZodType<ContentId> =>
  strategy === "serial"
    ? z.number().int().positive().max(CONTENT_SERIAL_MAX)
    : strategy === "bigint"
      ? z
          .string()
          .regex(BIGINT_PATTERN, "Expected a positive decimal bigint.")
          .refine(withinBigint, "Out of range for a bigint identifier.")
      : z.string().regex(UUID_PATTERN, "Expected a lowercase UUID.");

export const contentAnyIdSchema: z.ZodType<ContentId> = z.union([
  z.number().int().positive().max(CONTENT_SERIAL_MAX),
  z.string().min(1).max(CONTENT_ID_KEY_LENGTH),
]);

export const contentIdParamSchema = (
  strategy: ContentIdStrategy,
): z.ZodType<ContentId> =>
  z.string().transform((value, ctx) => {
    const parsed = parseContentId(strategy, value);
    if (parsed === null) {
      ctx.addIssue({
        code: "custom",
        message:
          strategy === "uuid"
            ? "Expected a lowercase UUID."
            : "Expected a positive integer identifier.",
      });

      return z.NEVER;
    }

    return parsed;
  });

export const compareContentIds = (
  strategy: ContentIdStrategy,
  a: ContentId,
  b: ContentId,
): number => {
  if (strategy === "serial") return Number(a) - Number(b);

  const left = String(a);
  const right = String(b);
  if (strategy === "bigint" && left.length !== right.length) {
    return left.length - right.length;
  }

  return left < right ? -1 : left > right ? 1 : 0;
};

export const requireContentId = (
  strategy: ContentIdStrategy,
  value: unknown,
  contentTypeId?: string,
): ContentId => {
  const parsed = parseContentId(strategy, value);
  if (parsed === null) {
    throw new ContentEngineError(
      `Expected a ${strategy} record identifier, got ${JSON.stringify(typeof value === "bigint" ? value.toString() : value)}.`,
      { contentTypeId },
    );
  }

  return parsed;
};

export const contentIdsOf = (
  strategy: ContentIdStrategy,
  values: readonly unknown[],
): ContentId[] => {
  const ids: ContentId[] = [];
  for (const value of values) {
    const parsed = parseContentId(strategy, value);
    if (parsed !== null) ids.push(parsed);
  }

  return ids;
};

export const contentIdSqlType = (
  strategy: ContentIdStrategy,
): "bigint" | "integer" | "uuid" =>
  strategy === "serial" ? "integer" : strategy;

export const contentRelationStrategy = (
  owner: { id: string; idStrategy: ContentIdStrategy },
  fieldValue: {
    self: boolean;
    target: () => undefined | { idStrategy: ContentIdStrategy };
  },
): ContentIdStrategy => {
  if (fieldValue.self) return owner.idStrategy;

  const target = fieldValue.target();
  if (!target) {
    throw new ContentEngineError(
      "A relation's target resolved to nothing. Usually a circular import between content type modules that read a target while it was still loading.",
      { contentTypeId: owner.id },
    );
  }

  return target.idStrategy;
};
