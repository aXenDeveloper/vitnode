import type { ContentFormSpec } from "@/content/admin/spec";

import {
  contentFormValuesToTranslations,
  isCollectionFieldSpec,
} from "@/content/admin/spec";

import type {
  ContentTranslationInput,
  TranslationRow,
} from "../content-mutation";

/**
 * What a content form decides *not* to send, and how it decides it.
 *
 * Three rules, all of them pure, all of them lifted out of `content-form.tsx`
 * unchanged. They were closures over the component's props until Stage 13, which
 * made them untestable - and each one is a rule whose failure mode is silent
 * data loss rather than an error anybody would see:
 *
 * - {@link missingContentCollections} decides whether the row a dialog was
 *   handed is complete enough to edit. Get it wrong and a form opens on empty
 *   sets and **saves them that way**.
 * - {@link contentTranslationDiff} decides which languages are sent and with
 *   which version precondition. Get it wrong and a Polish-only edit bumps every
 *   language's version, or a stale English copy is written over a colleague's.
 * - {@link contentSharedChanged} decides whether the base row is sent at all.
 *   Get it wrong and every save writes a revision that changed nothing.
 */

/**
 * The collection fields of a row that are not on it.
 *
 * A repeatable, a to-many reference and a gallery are all stored on tables of
 * their own, so the admin *list* deliberately leaves them off its rows -
 * carrying them would cost queries per page for values no column renders. A
 * dialog-mode form is handed one of those rows, and a form that opened on the
 * empty set for each would show an article with no categories, no gallery, and
 * then **save it that way**.
 *
 * Empty for a page-mode form, whose loader read the record's detail and already
 * has them - so the common case costs no request at all.
 *
 * The test is `Array.isArray`, not truthiness: a record that genuinely has no
 * categories arrives as `[]`, which is an answer, and re-reading the detail for
 * it would cost a request per dialog for no change.
 */
export const missingContentCollections = (
  spec: ContentFormSpec,
  data: Record<string, unknown>,
): string[] =>
  spec.fields
    .filter(isCollectionFieldSpec)
    .map(field => field.name)
    .filter(name => !Array.isArray(data[name]));

/**
 * Which languages a composite save actually sends, and with which precondition.
 *
 * Per language, in order:
 *
 * - **A language the record has no translation in** is sent whole, with no
 *   `expectedVersion` - there is no version to be stale against, and the API
 *   creates it.
 * - **A language that exists** is diffed field by field against the values the
 *   form *opened* with, and only the fields that moved are sent, carrying that
 *   translation's own version. Two translators working in two languages
 *   therefore never contend, and a stale one is refused for that language alone,
 *   before anything commits.
 * - **A language nothing moved in** is not in the result at all. That is what
 *   keeps a Polish-only edit from writing an English revision, firing an English
 *   event and expiring the English public cache.
 *
 * The comparison is `!==` on the value the form holds, which is a string, a
 * number, a boolean or `null` for every localized field - a localized field is a
 * scalar by construction, so there is no object identity to be fooled by.
 *
 * Locales are matched case-insensitively because the form's per-field language
 * switcher keys by the language code the definition declares and the API answers
 * with the code stored in `core_languages`; `pl` and `PL` are one language, and
 * treating them as two would send a create for a translation that exists.
 */
export const contentTranslationDiff = (
  spec: ContentFormSpec,
  submitted: Record<string, unknown>,
  opened: readonly TranslationRow[],
): ContentTranslationInput[] => {
  const byLocale = contentFormValuesToTranslations(spec, submitted);
  const entries: ContentTranslationInput[] = [];

  for (const [code, next] of Object.entries(byLocale)) {
    const existing = opened.find(
      row => row.locale.toLowerCase() === code.toLowerCase(),
    );

    if (!existing) {
      entries.push({ locale: code, values: next });
      continue;
    }

    const changed = Object.fromEntries(
      Object.entries(next).filter(
        ([name, value]) => existing.values[name] !== value,
      ),
    );
    if (Object.keys(changed).length === 0) continue;

    entries.push({
      expectedVersion: existing.version,
      locale: existing.locale,
      values: changed,
    });
  }

  return entries;
};

/**
 * Whether any shared field moved since the form opened.
 *
 * `true` for a create, which has nothing to compare against and everything to
 * send.
 *
 * An array is compared element by element and in order, because that is what a
 * to-many field is: `[3, 9]` and `[9, 3]` are different values for an ordered
 * relation, and the engine stores the order. Only the *payload's* keys are
 * looked at, so a column the form does not edit - `updatedAt`, `version`,
 * `labels` - never makes a save look necessary.
 */
export const contentSharedChanged = (
  data: Record<string, unknown> | undefined,
  payload: Record<string, unknown>,
): boolean => {
  if (!data) return true;

  return Object.entries(payload).some(([name, value]) => {
    const before = data[name];

    if (Array.isArray(before) && Array.isArray(value)) {
      return (
        before.length !== value.length ||
        before.some((item, index) => item !== value[index])
      );
    }

    return before !== value;
  });
};
