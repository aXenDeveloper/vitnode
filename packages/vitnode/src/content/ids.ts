import { z } from "zod";

import type { CONTENT_ID_STRATEGIES } from "./const";

/** How a content type's primary key is generated. Defaults to `serial`. */
export type ContentIdStrategy = (typeof CONTENT_ID_STRATEGIES)[number];

/**
 * The identifier of one record under a strategy, as every JSON-facing surface
 * carries it: a `serial` is a JavaScript number, and a `uuid` or a `bigint` is a
 * string. A `bigint` stays a canonical decimal string end to end - it never
 * passes through `Number`, which would round anything above 2^53.
 */
export type ContentIdOfStrategy<TStrategy> = TStrategy extends "serial"
  ? number
  : string;

/**
 * The identifier type of one content type. Concrete definitions resolve to
 * exactly one of `number` or `string`; the erased `AnyContentTypeDefinition`
 * resolves to the union, which is what generic engine code handles.
 */
export type ContentIdOf<TDefinition> = TDefinition extends {
  idStrategy: infer TStrategy;
}
  ? ContentIdOfStrategy<TStrategy>
  : number;

/** Any record identifier, under any strategy. */
export type ContentId = number | string;

/** The largest value a Postgres `integer` (and so a `serial`) can hold. */
export const CONTENT_SERIAL_MAX = 2_147_483_647;

/** The largest value a Postgres `bigint` can hold, as a decimal string. */
export const CONTENT_BIGINT_MAX = "9223372036854775807";

const SERIAL_PATTERN = /^[1-9][0-9]{0,9}$/;
const BIGINT_PATTERN = /^[1-9][0-9]{0,18}$/;
/** Canonical form only: lowercase, hyphenated, 8-4-4-4-12. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const withinBigint = (value: string): boolean =>
  value.length < CONTENT_BIGINT_MAX.length ||
  (value.length === CONTENT_BIGINT_MAX.length && value <= CONTENT_BIGINT_MAX);

/**
 * Reads an identifier from untrusted input - a path segment, a query value, a
 * JSON body - and returns it in its strategy's canonical representation, or
 * `null` when it is malformed, out of range or not canonical.
 *
 * - `serial`: a positive integer up to 2147483647, as a number or as decimal
 *   digits without a sign, leading zeros or whitespace.
 * - `bigint`: a positive integer up to 9223372036854775807, as decimal digits
 *   without a sign, leading zeros or whitespace. A JavaScript number is accepted
 *   only while it is a safe integer, since a larger one has already been rounded.
 * - `uuid`: lowercase hyphenated 8-4-4-4-12 hex. Uppercase and braces are refused
 *   rather than folded, so one record has exactly one spelling in URLs and caches.
 */
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

/** {@link parseContentId} for one definition, narrowed to its own id type. */
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

/**
 * The storage key of an identifier in the shared tables that reference records
 * of any content type (revisions, schedules, slug history, the search index),
 * in cache tags and in search document ids. Decimal digits for `serial` and
 * `bigint`, the canonical spelling for `uuid` - so an existing serial record's
 * key is exactly the digits it always had.
 */
export const contentIdKey = (id: ContentId): string => String(id);

/** The inverse of {@link contentIdKey}: a stored key back to the API representation. */
export const contentIdFromKey = (
  strategy: ContentIdStrategy,
  key: string,
): ContentId | null => parseContentId(strategy, key);

/** Whether a value is already a valid identifier under `strategy`. */
export const isContentId = (
  strategy: ContentIdStrategy,
  value: unknown,
): value is ContentId => {
  const parsed = parseContentId(strategy, value);

  return parsed !== null && parsed === value;
};

/**
 * The Zod schema of one identifier as it crosses JSON: a positive integer for
 * `serial`, a decimal string for `bigint`, a canonical UUID for `uuid`.
 */
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

/**
 * The Zod schema of one identifier read from a path segment or a query string,
 * where every value arrives as text. A `serial` is coerced to a number.
 */
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

/**
 * Orders two identifiers of the same strategy the way Postgres orders the
 * column: numerically for `serial` and `bigint` (by length, then digits, since
 * both are canonical), lexically for `uuid`.
 */
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
