import type { AuditChange, AuditChanges } from "./const";

import {
  AUDIT_ARRAY_MAX_ITEMS,
  AUDIT_CHANGES_MAX_FIELDS,
  AUDIT_JSON_MAX_BYTES,
  AUDIT_MAX_DEPTH,
  AUDIT_OBJECT_MAX_KEYS,
  AUDIT_REDACTED,
  AUDIT_RICH_TEXT,
  AUDIT_STRING_MAX_LENGTH,
  AUDIT_TRUNCATED,
} from "./const";

/** Words that make a key sensitive wherever they appear in it. */
const SENSITIVE_WORDS = new Set([
  "authorization",
  "cookie",
  "cookies",
  "credential",
  "credentials",
  "hash",
  "otp",
  "passphrase",
  "passwd",
  "password",
  "salt",
  "secret",
  "secrets",
  "totp",
]);

/** Word pairs that are sensitive together but harmless apart (`api` + `key`). */
const SENSITIVE_PAIRS: readonly (readonly [string, string])[] = [
  ["access", "key"],
  ["api", "key"],
  ["private", "key"],
  ["recovery", "code"],
  ["recovery", "codes"],
  ["session", "id"],
  ["signing", "key"],
];

/** Splits `refreshToken`, `refresh_token` and `REFRESH-TOKEN` into lowercase words. */
const keyWords = (key: string): string[] =>
  key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(word => word !== "");

/**
 * Whether a field or metadata key names something that must never be stored
 * in an audit entry: passwords and their hashes, tokens, secrets, API and
 * private keys, cookies, recovery codes, credentials. Matched on whole words,
 * so `accessToken` and `client_secret` are sensitive while `maxTokens` and
 * `keyboard` are not.
 */
export const isSensitiveAuditKey = (key: string): boolean => {
  const words = keyWords(key);
  if (words.some(word => SENSITIVE_WORDS.has(word))) return true;
  // `token` names a credential; `tokens` is a count (`maxTokens`).
  if (words.at(-1) === "token") return true;

  return SENSITIVE_PAIRS.some(([first, second]) => {
    const index = words.indexOf(first);

    return index !== -1 && words[index + 1] === second;
  });
};

/** Whether a value is a rich-text (TipTap) document: `{ type: "doc", content: [...] }`. */
export const isRichTextDocument = (value: unknown): boolean =>
  typeof value === "object" &&
  value !== null &&
  (value as { type?: unknown }).type === "doc" &&
  Array.isArray((value as { content?: unknown }).content);

const truncateString = (value: string): string =>
  value.length > AUDIT_STRING_MAX_LENGTH
    ? `${value.slice(0, AUDIT_STRING_MAX_LENGTH)}…`
    : value;

const isPlainObject = (value: object): value is Record<string, unknown> => {
  const prototype = Object.getPrototypeOf(value) as unknown;

  return prototype === Object.prototype || prototype === null;
};

/**
 * Turns any value into a bounded, JSON-safe one that is safe to store:
 * sensitive keys are replaced with `[redacted]`, long strings and collections
 * are cut, rich-text documents become a marker (the revision keeps the
 * document), errors keep their name only, and anything that is not data
 * (functions, symbols, class instances) is dropped. Universal.
 */
export const sanitizeAuditValue = (value: unknown, depth = 0): unknown => {
  if (value === null) return null;

  switch (typeof value) {
    case "bigint":
      return value.toString();
    case "boolean":
      return value;
    case "number":
      return Number.isFinite(value) ? value : null;
    case "object":
      break;
    case "string":
      return truncateString(value);
    default:
      return undefined;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  // An error's message is where connection strings and tokens end up, so only
  // its class survives.
  if (value instanceof Error) return { error: value.name };
  if (depth >= AUDIT_MAX_DEPTH) return AUDIT_TRUNCATED;

  if (Array.isArray(value)) {
    const items = value
      .slice(0, AUDIT_ARRAY_MAX_ITEMS)
      .map(item => sanitizeAuditValue(item, depth + 1) ?? null);

    return value.length > AUDIT_ARRAY_MAX_ITEMS
      ? [...items, AUDIT_TRUNCATED]
      : items;
  }

  if (isRichTextDocument(value)) return AUDIT_RICH_TEXT;
  if (!isPlainObject(value)) return undefined;

  const result: Record<string, unknown> = {};
  const entries = Object.entries(value);
  for (const [key, entry] of entries.slice(0, AUDIT_OBJECT_MAX_KEYS)) {
    if (isSensitiveAuditKey(key)) {
      result[key] = AUDIT_REDACTED;
      continue;
    }
    const sanitized = sanitizeAuditValue(entry, depth + 1);
    if (sanitized !== undefined) result[key] = sanitized;
  }
  if (entries.length > AUDIT_OBJECT_MAX_KEYS) result[AUDIT_TRUNCATED] = true;

  return result;
};

const byteLength = (value: unknown): number =>
  new TextEncoder().encode(JSON.stringify(value)).byteLength;

/**
 * Sanitizes free-form metadata with {@link sanitizeAuditValue} and enforces
 * the serialized size budget: metadata over it is replaced with
 * `{ "[truncated]": true }` rather than half-stored.
 */
export const sanitizeAuditMetadata = (
  metadata: null | Record<string, unknown> | undefined,
): Record<string, unknown> => {
  if (!metadata) return {};
  const sanitized = sanitizeAuditValue(metadata);
  if (!sanitized || typeof sanitized !== "object" || Array.isArray(sanitized)) {
    return {};
  }
  if (byteLength(sanitized) > AUDIT_JSON_MAX_BYTES) {
    return { [AUDIT_TRUNCATED]: true };
  }

  return sanitized as Record<string, unknown>;
};

/**
 * Sanitizes structured changes: a sensitive field keeps only the fact that it
 * changed (`{ redacted: true }`), every value goes through
 * {@link sanitizeAuditValue}, at most {@link AUDIT_CHANGES_MAX_FIELDS} fields
 * are kept, and when the result is still over the size budget the values are
 * dropped while the field names stay. `null` when nothing is left.
 */
export const sanitizeAuditChanges = (
  changes: AuditChanges | null | undefined,
): AuditChanges | null => {
  if (!changes) return null;

  const result: AuditChanges = {};
  for (const [field, change] of Object.entries(changes).slice(
    0,
    AUDIT_CHANGES_MAX_FIELDS,
  )) {
    if (isSensitiveAuditKey(field) || change.redacted) {
      result[field] = { redacted: true };
      continue;
    }

    const entry: AuditChange = {};
    if ("from" in change) entry.from = sanitizeAuditValue(change.from) ?? null;
    if ("to" in change) entry.to = sanitizeAuditValue(change.to) ?? null;
    result[field] = entry;
  }

  if (Object.keys(result).length === 0) return null;
  if (byteLength(result) <= AUDIT_JSON_MAX_BYTES) return result;

  return Object.fromEntries(
    Object.entries(result).map(([field, change]) => [
      field,
      change.redacted ? change : { from: AUDIT_TRUNCATED, to: AUDIT_TRUNCATED },
    ]),
  );
};
