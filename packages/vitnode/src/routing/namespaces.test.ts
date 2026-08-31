// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  MAX_NAMESPACE_DEPTH,
  MAX_NAMESPACE_LENGTH,
  namespaceProblem,
  normalizeNamespaceList,
} from "./namespaces";

describe("namespaceProblem", () => {
  it.each(["core.global", "@vitnode/blog", "@vitnode/blog.post.comments", "a"])(
    "accepts %s",
    namespace => {
      expect(namespaceProblem(namespace)).toBeNull();
    },
  );

  it.each([
    [undefined, "must be a string."],
    [null, "must be a string."],
    [7, "must be a string."],
    ["", "must not be empty."],
    ["core..global", "must not contain an empty segment."],
    [".core", "must not contain an empty segment."],
    ["core.", "must not contain an empty segment."],
    ["core.__proto__.x", "contains a forbidden segment."],
    ["constructor", "contains a forbidden segment."],
    ["a.prototype", "contains a forbidden segment."],
  ])("rejects %s", (value, reason) => {
    expect(namespaceProblem(value)).toBe(reason);
  });

  it("rejects a namespace that is too long", () => {
    expect(namespaceProblem("a".repeat(MAX_NAMESPACE_LENGTH))).toBeNull();
    expect(namespaceProblem("a".repeat(MAX_NAMESPACE_LENGTH + 1))).toBe(
      `must be at most ${MAX_NAMESPACE_LENGTH} characters.`,
    );
  });

  it("rejects a namespace that is too deep", () => {
    const deep = Array.from({ length: MAX_NAMESPACE_DEPTH + 1 }, () => "a");

    expect(namespaceProblem(deep.slice(1).join("."))).toBeNull();
    expect(namespaceProblem(deep.join("."))).toBe(
      `must be at most ${MAX_NAMESPACE_DEPTH} segments.`,
    );
  });

  /**
   * The message is a predicate with no subject, so a caller can put its own in
   * front of it. Both callers do - the manifest names the plugin and the route,
   * the i18n server function names the index - and neither should have to strip
   * a prefix this function decided on.
   */
  it("returns a sentence a caller can prefix", () => {
    expect(`namespaces[0] ${namespaceProblem(4)}`).toBe(
      "namespaces[0] must be a string.",
    );
  });
});

describe("normalizeNamespaceList", () => {
  it("de-duplicates and sorts", () => {
    expect(
      normalizeNamespaceList(["core.search", "core.global", "core.search"]),
    ).toEqual(["core.global", "core.search"]);
  });

  it("is idempotent", () => {
    const once = normalizeNamespaceList(["b", "a", "b"]);

    expect(normalizeNamespaceList(once)).toEqual(once);
  });

  /**
   * By code unit, not `localeCompare`. This list is written into a generated
   * file, so an order that depends on the machine's locale is a diff that only
   * appears on somebody else's laptop.
   */
  it("orders by code unit", () => {
    expect(normalizeNamespaceList(["a", "B", "_x", "@vitnode/blog"])).toEqual([
      "@vitnode/blog",
      "B",
      "_x",
      "a",
    ]);
  });

  it("keeps an empty list empty", () => {
    expect(normalizeNamespaceList([])).toEqual([]);
  });
});
