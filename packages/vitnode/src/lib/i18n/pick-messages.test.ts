// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { isUnsafeMessagePath, pickMessages } from "./pick-messages";

/**
 * Which namespaces reach the client bundle.
 *
 * `I18nProvider` ships only what it is handed, and a plugin's AdminCP overrides
 * - a `forms.layout`, a field component, a column cell - are client components
 * that translate themselves out of the plugin's own namespace. Leaving that
 * namespace out is not a missing string but a thrown `MISSING_MESSAGE` on every
 * one of them, so the rule is pinned here.
 */
const messages = {
  "@vitnode/blog": {
    admin: {
      article: {
        form: { publish: "Publish", settings: { title: "Settings" } },
      },
      category: { color: { label: "Color" } },
    },
    title: "Blog",
  },
  core: {
    content: { form: { list: { add: "Add {label}" } } },
    global: { save: "Save" },
    secrets: { token: "never-ship-me" },
  },
};

describe("pickMessages", () => {
  it("ships a whole plugin namespace from its id alone", () => {
    // The plugin id *is* the top-level messages key, so an author declares
    // nothing: registering the content type is what makes its strings available.
    const picked = pickMessages(messages, ["core.global", "@vitnode/blog"]);

    expect(picked).toStrictEqual({
      "@vitnode/blog": messages["@vitnode/blog"],
      core: { global: { save: "Save" } },
    });
  });

  it("resolves a dotted namespace through the nested tree", () => {
    expect(
      pickMessages(messages, ["@vitnode/blog.admin.article.form"]),
    ).toStrictEqual({
      "@vitnode/blog": {
        admin: {
          article: { form: messages["@vitnode/blog"].admin.article.form },
        },
      },
    });
  });

  it("ships nothing a caller did not name", () => {
    const picked = pickMessages(messages, ["core.global"]);

    // The allowlist is the whole point: an unnamed namespace stays on the
    // server rather than travelling to every browser.
    expect(picked).toStrictEqual({ core: { global: { save: "Save" } } });
    expect(JSON.stringify(picked)).not.toContain("never-ship-me");
  });

  it("skips a namespace that resolves to nothing", () => {
    // A plugin with no messages, or one whose id was resolved for a request
    // that has none - neither is an error.
    expect(
      pickMessages(messages, ["core.global", "@vitnode/nothing-here"]),
    ).toStrictEqual({ core: { global: { save: "Save" } } });
  });

  it("merges two namespaces that share a parent", () => {
    expect(
      pickMessages(messages, ["core.global", "core.content"]),
    ).toStrictEqual({
      core: { content: messages.core.content, global: messages.core.global },
    });
  });
});

/**
 * `pickMessages` is reached from a public server function, so it is treated as
 * a boundary in its own right rather than trusting whatever validated the input
 * upstream. Every assertion here is about a path that should never arrive - and
 * about what happens when one does anyway.
 */
describe("prototype safety", () => {
  const tree = {
    core: { global: { close: "Close" } },
  };

  afterEach(() => {
    // Anything leaked by a previous case would make the next one pass for the
    // wrong reason.
    delete (Object.prototype as Record<string, unknown>).polluted;
  });

  it("does not pollute Object.prototype through __proto__", () => {
    const source = JSON.parse('{"__proto__": {"polluted": "yes"}}') as object;

    const result = pickMessages(source, ["__proto__"]);

    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(result).toEqual({});
  });

  it("does not pollute through a nested __proto__ path", () => {
    const source = JSON.parse('{"__proto__": {"polluted": "yes"}}') as object;

    pickMessages(source, ["__proto__.polluted"]);

    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("does not pollute through constructor.prototype", () => {
    const result = pickMessages(tree, ["constructor.prototype.polluted"]);

    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(result).toEqual({});
  });

  it("refuses an unsafe segment anywhere in the path", () => {
    expect(pickMessages(tree, ["core.__proto__"])).toEqual({});
    expect(pickMessages(tree, ["core.constructor.global"])).toEqual({});
    expect(pickMessages(tree, ["core.global.prototype"])).toEqual({});
  });

  it("never reads a key off the prototype chain", () => {
    // `toString` and `hasOwnProperty` exist on every object, but not as *own*
    // properties of the message tree - so neither is a message. A path that
    // gets partway before missing still creates the branch it walked through,
    // which is long-standing behaviour and copies no value.
    expect(pickMessages(tree, ["toString"])).toEqual({});
    expect(pickMessages(tree, ["core.hasOwnProperty"])).toEqual({ core: {} });
    expect(
      Object.hasOwn(
        pickMessages(tree, ["core.hasOwnProperty"]).core as object,
        "hasOwnProperty",
      ),
    ).toBe(false);
  });

  it("keeps the result an ordinary object, which React must be able to serialize", () => {
    // `Object.create(null)` would be marginally safer here and would have
    // broken the Next.js host: React's Flight serializer rejects anything whose
    // prototype is not `Object.prototype`. Kept after that host went, because
    // `use-intl` walks the record and a null-prototype object is a surprise
    // waiting for whatever walks it next.
    const result = pickMessages(tree, ["core.global"]);

    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(result.core)).toBe(Object.prototype);
  });
});

describe("isUnsafeMessagePath", () => {
  it.each(["__proto__", "constructor", "prototype"])(
    "flags %s as a segment",
    segment => {
      expect(isUnsafeMessagePath(segment)).toBe(true);
      expect(isUnsafeMessagePath(`core.${segment}`)).toBe(true);
      expect(isUnsafeMessagePath(`${segment}.core`)).toBe(true);
    },
  );

  it.each(["core.global", "core.search", "@vitnode/blog.someNamespace"])(
    "leaves the real namespace %s alone",
    path => {
      expect(isUnsafeMessagePath(path)).toBe(false);
    },
  );

  it("does not flag a segment that merely contains an unsafe word", () => {
    expect(isUnsafeMessagePath("core.constructors")).toBe(false);
    expect(isUnsafeMessagePath("core.prototypeName")).toBe(false);
  });
});
