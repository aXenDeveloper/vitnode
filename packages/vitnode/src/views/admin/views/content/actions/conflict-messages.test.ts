// @vitest-environment node
import { createTranslator } from "use-intl";
import { describe, expect, it } from "vitest";

import messages from "@/locales/en.json";

/**
 * Every message the conflict dialog formats, with exactly the arguments it
 * passes.
 *
 * This exists because of a bug that reached a user. `desc` was written as
 * `{name, select, other {record}}` - a `select` with only an `other` branch, so
 * it *required* a `name` argument and then ignored it, always rendering the word
 * "record". The dialog passed only `{ version }`.
 *
 * A missing ICU argument is not a blank in use-intl. It is a `FORMATTING_ERROR`,
 * and the fallback it renders is the **key path** - so an editor whose save was
 * refused read the literal string `core.content.conflict.desc` where the
 * explanation should have been. Nothing crashed, nothing was logged where anybody
 * would see it, and the one screen that has to explain itself said nothing.
 *
 * So the assertion is not "the key exists" - it did exist. It is "the message
 * formats with the arguments the caller actually has".
 */
const format = (
  key: string,
  values: Record<string, number | string>,
): { errors: string[]; text: string } => {
  const errors: string[] = [];
  // Widened on purpose: the key is computed at runtime here, and use-intl's
  // typed signature narrows the values parameter to `undefined` for a key it
  // cannot see. The point of this suite is what happens at *format* time.
  const t = createTranslator({
    locale: "en",
    messages,
    onError: error => errors.push(error.code),
  }) as unknown as (
    key: string,
    values?: Record<string, number | string>,
  ) => string;

  return { errors, text: t(`core.content.conflict.${key}`, values) };
};

/** The arguments each message is given at its one call site. */
const CALLS: { key: string; values: Record<string, number | string> }[] = [
  { key: "title", values: {} },
  { key: "desc", values: { name: "Article", version: 5 } },
  { key: "reloaded", values: { version: 5 } },
  { key: "reload", values: {} },
];

/**
 * The argument names an ICU message needs.
 *
 * Deliberately naive about nesting - these four messages are flat - and
 * deliberately *including* the ones a `select` or a `plural` keys on, because
 * those are exactly the mandatory arguments the original bug forgot.
 */
const placeholdersOf = (message: string): string[] =>
  [
    ...new Set(
      [...message.matchAll(/\{\s*(\w+)\s*(?:,|\})/g)].map(match => match[1]),
    ),
  ].sort();

describe("the conflict dialog's messages", () => {
  /**
   * The root cause, stated directly: the call site and the message have to agree
   * about the arguments.
   *
   * The original bug was not a missing key and not a typo - it was a message that
   * needed `name` and a caller that passed only `version`. Nothing in the type
   * system connects those two, so this is the thing that has to.
   */
  it.each(CALLS)(
    "$key needs exactly the arguments it is passed",
    ({ key, values }) => {
      const message = (
        messages.core.content.conflict as Record<string, string>
      )[key];

      expect(placeholdersOf(message)).toEqual(Object.keys(values).sort());
    },
  );

  it.each(CALLS)(
    "formats $key with the arguments it is given",
    ({ key, values }) => {
      const { errors, text } = format(key, values);

      expect(errors).toEqual([]);
      // The tell-tale of a formatting failure: use-intl renders the key path.
      expect(text).not.toContain("core.content.conflict");
      expect(text.trim()).not.toBe("");
    },
  );

  it("names the record rather than calling it a record", () => {
    const { text } = format("desc", { name: "Article", version: 5 });

    expect(text).toContain("Article");
    expect(text).toContain("5");
  });

  it("says the save did not happen, which is the part that was missing", () => {
    // The old copy said the record "moved" and that nothing was lost, but never
    // that the save had been refused - so the obvious next move was to press Save
    // again, which is exactly what it should not be.
    const { text } = format("desc", { name: "Article", version: 5 });

    expect(text).toMatch(/did not go through/);
  });

  /**
   * The guard against the shape that caused this.
   *
   * A `select` whose only branch is `other` cannot vary its output, so it buys
   * nothing and costs a mandatory argument. If one is ever wanted, it needs real
   * branches - and a caller that passes the value they key on.
   */
  it("uses no single-branch select anywhere in the block", () => {
    const conflict = messages.core.content.conflict as Record<string, string>;

    for (const [key, message] of Object.entries(conflict)) {
      expect(message, key).not.toMatch(
        /\{\s*\w+\s*,\s*select\s*,\s*other\s*\{/,
      );
    }
  });
});
