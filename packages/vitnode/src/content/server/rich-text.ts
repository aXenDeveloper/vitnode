import { z } from "zod";

import type { ContentFieldDescriptor, ContentFieldMap } from "../types";

import { sanitizeEditorHtml } from "../../lib/sanitize-editor-html";
import { CONTENT_RICH_TEXT_MAX_HTML_LENGTH } from "../const";
import { contentInnerFields } from "../paths";
import {
  contentRichTextIssue,
  hasContentRichTextField,
  isContentRichTextEmpty,
} from "../rich-text";

/**
 * Server-side rich text normalisation: sanitise, then hold the *sanitised*
 * value to the field's rules. Never imported by anything that reaches the
 * browser - `sanitize-html` is a server dependency.
 */

export type ContentRichTextNormalized =
  { issue: string; ok: false } | { ok: true; value: unknown };

/**
 * One value of a `richText` field, as it will be stored.
 *
 * The size limit is checked before sanitising, so a hostile payload is refused
 * before `sanitize-html` spends any time on it, and again after, since the
 * sanitiser may add attributes (`rel` on a `target="_blank"` link). A value that
 * sanitises to nothing a reader would get fails `required` - `<script>` alone
 * is not an article body - and is stored as `null` (nullable) or `""` otherwise.
 */
export const normalizeContentRichText = (
  fieldValue: Pick<
    ContentFieldDescriptor & { kind: "richText" },
    "maxLength" | "minLength" | "nullable" | "required"
  >,
  raw: unknown,
): ContentRichTextNormalized => {
  if (typeof raw !== "string") return { ok: true, value: raw };

  if (raw.length > CONTENT_RICH_TEXT_MAX_HTML_LENGTH) {
    return {
      issue: `Rich text can hold at most ${CONTENT_RICH_TEXT_MAX_HTML_LENGTH} characters of HTML.`,
      ok: false,
    };
  }

  const sanitized = sanitizeEditorHtml(raw);
  const issue = contentRichTextIssue(fieldValue, sanitized);
  if (issue !== null) return { issue, ok: false };

  if (isContentRichTextEmpty(sanitized)) {
    return { ok: true, value: fieldValue.nullable ? null : "" };
  }

  return { ok: true, value: sanitized };
};

type IssueSink = (path: PropertyKey[], message: string) => void;

const normalizeLeaves = (
  fields: ContentFieldMap,
  values: Record<string, unknown>,
  path: PropertyKey[],
  report: IssueSink,
): Record<string, unknown> => {
  let next = values;

  const set = (name: string, value: unknown): void => {
    if (values[name] === value) return;
    if (next === values) next = { ...values };
    next[name] = value;
  };

  for (const [name, value] of Object.entries(values)) {
    const fieldValue = fields[name] as ContentFieldDescriptor | undefined;
    if (!fieldValue || value === undefined) continue;

    if (fieldValue.kind === "richText") {
      const result = normalizeContentRichText(fieldValue, value);
      if (result.ok) {
        set(name, result.value);
      } else {
        report([...path, name], result.issue);
      }
      continue;
    }

    if (fieldValue.kind === "group") {
      if (value === null || typeof value !== "object") continue;

      set(
        name,
        normalizeLeaves(
          contentInnerFields(fieldValue),
          value as Record<string, unknown>,
          [...path, name],
          report,
        ),
      );
      continue;
    }

    if (fieldValue.kind === "repeatable" && Array.isArray(value)) {
      const inner = contentInnerFields(fieldValue);
      let changed = false;
      const rows = (value as unknown[]).map((row, index) => {
        if (row === null || typeof row !== "object") return row;

        const normalized = normalizeLeaves(
          inner,
          row as Record<string, unknown>,
          [...path, name, index],
          report,
        );
        if (normalized !== row) changed = true;

        return normalized;
      });

      if (changed) set(name, rows);
    }
  }

  return next;
};

/**
 * Sanitises and validates every `richText` value in a parsed write - top-level
 * fields, group leaves and repeatable rows alike - reporting each failure at
 * its own path so the generated routes answer with a field error.
 */
export const normalizeContentRichTextValues = (
  fields: ContentFieldMap,
  values: Record<string, unknown>,
  report: IssueSink,
): Record<string, unknown> => normalizeLeaves(fields, values, [], report);

const wrapped = new WeakMap<z.ZodType, z.ZodType>();

const withNormalization = <TSchema extends z.ZodType>(
  schema: TSchema,
  fields: ContentFieldMap,
): TSchema => {
  const cached = wrapped.get(schema);
  if (cached) return cached as TSchema;

  const next = schema.transform((value, ctx) => {
    if (value === null || typeof value !== "object") return value;

    let failed = false;
    const normalized = normalizeContentRichTextValues(
      fields,
      value as Record<string, unknown>,
      (path, message) => {
        failed = true;
        ctx.addIssue({ code: "custom", input: value, message, path });
      },
    );

    return failed ? z.NEVER : normalized;
  }) as unknown as TSchema;

  wrapped.set(schema, next);

  return next;
};

/**
 * The write schemas a service parses with: the definition's own `create` and
 * `update`, followed by rich text sanitising and validation.
 *
 * **The** rich text hook. Every service that writes content values - the base
 * service, the editorial service, the translation model and the translation
 * editorial service - builds its schemas through this, so any path that goes
 * through one of them (create, update, restore, collections, a localized
 * composite create, a duplicate) stores sanitised HTML. Returns `schemas`
 * untouched for a content type with no `richText` field.
 */
export const withContentRichTextWrites = <
  TSchemas extends { create: z.ZodType; update: z.ZodType },
>(
  schemas: TSchemas,
  fields: ContentFieldMap,
): TSchemas => {
  if (!hasContentRichTextField(fields)) return schemas;

  return {
    ...schemas,
    create: withNormalization(schemas.create, fields),
    update: withNormalization(schemas.update, fields),
  };
};
