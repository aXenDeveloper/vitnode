// @vitest-environment node
import { describe, expect, it } from "vitest";

import { pickMessages } from "./pick-messages";

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
