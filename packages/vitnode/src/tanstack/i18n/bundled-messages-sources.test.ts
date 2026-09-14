// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import type { MessagesLoader } from "@/lib/i18n/types";

vi.mock("@tanstack/react-start/server-only", () => ({}));

const { buildBundledMessagesSources } = await import("./messages");

const loader: MessagesLoader = async () =>
  await Promise.resolve({ default: {} });

/** The shape `src/package-messages.gen.ts` exports, core first. */
const packageMessages = {
  "@acme/blog": { en: loader, pl: loader },
  "@acme/docs": { en: loader },
  "@vitnode/core": { en: loader, pl: loader },
};

const sources = (
  plugins: { pluginId: string }[] = [
    { pluginId: "@acme/docs" },
    { pluginId: "@acme/blog" },
  ],
) =>
  buildBundledMessagesSources({
    appMessages: { en: { "@vitnode/core": loader } },
    packageMessages,
    plugins,
  });

describe("buildBundledMessagesSources", () => {
  /**
   * Later sources win, so this list *is* the merge order: core underneath, each
   * plugin over it in the order the app configured them, and the app's own
   * rewordings on top of all of it.
   */
  it("merges core first, then plugins in configured order, then the app", () => {
    expect(sources().map(source => source.id)).toEqual([
      "@vitnode/core",
      "@acme/docs",
      "@acme/blog",
      "app:@vitnode/core",
    ]);
  });

  /**
   * The generated file is keyed by plugin id and the configured list is what
   * orders it, so re-ordering the plugins re-orders the merge - the generator's
   * own sorting by id never reaches the runtime.
   */
  it("takes its order from the config rather than from the generated keys", () => {
    expect(
      sources([{ pluginId: "@acme/blog" }, { pluginId: "@acme/docs" }]).map(
        source => source.id,
      ),
    ).toEqual([
      "@vitnode/core",
      "@acme/blog",
      "@acme/docs",
      "app:@vitnode/core",
    ]);
  });

  it("hands each package the loaders the generated file declared for it", () => {
    const [core, docs, blog] = sources();

    expect(Object.keys(core.messages ?? {})).toEqual(["en", "pl"]);
    expect(Object.keys(docs.messages ?? {})).toEqual(["en"]);
    expect(Object.keys(blog.messages ?? {})).toEqual(["en", "pl"]);
  });

  /**
   * A plugin that ships no locale files at all is still a source, with nothing
   * in it - which is what keeps a missing translation a fallback rather than a
   * failed lookup.
   */
  it("keeps a plugin that declared no locale files", () => {
    const quiet = sources([{ pluginId: "@acme/quiet" }])[1];

    expect(quiet.id).toBe("@acme/quiet");
    expect(quiet.messages).toBeUndefined();
  });

  it("still registers core when nothing is configured", () => {
    expect(
      buildBundledMessagesSources({ packageMessages, plugins: [] }).map(
        source => source.id,
      ),
    ).toEqual(["@vitnode/core"]);
  });

  /** Every source carries the scope the cache keys off. */
  it("stamps the web scope on all of them", () => {
    expect(sources().every(source => source.scope === "web")).toBe(true);
  });

  /** An override file only carries the keys it changes. */
  it("marks the app's own overrides optional and nothing else", () => {
    expect(sources().map(source => source.optional ?? false)).toEqual([
      false,
      false,
      false,
      true,
    ]);
  });
});
