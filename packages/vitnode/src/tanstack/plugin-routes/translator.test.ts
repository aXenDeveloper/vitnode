// @vitest-environment node
import type { QueryClient } from "@tanstack/react-query";

import { describe, expect, it, vi } from "vitest";

import type { PluginRouteSpec } from "./specs";

import { pluginRouteTranslator } from "./translator";

const specWith = (namespaces: string[]): PluginRouteSpec =>
  ({
    namespaces,
    route: { id: "@acme/notes:page#/notes" },
  }) as PluginRouteSpec;

const clientWith = (messages: unknown) =>
  ({
    query: vi.fn(async () => await Promise.resolve({ messages })),
  }) as unknown as QueryClient;

const NOTES = {
  "@acme/notes": {
    home: { greeting: "Cześć {name}", title: "Notatki" },
  },
};

/**
 * The door `head` translates through.
 *
 * `head` runs outside the React tree - there is no provider to read, so
 * `useTranslations` cannot reach it - and this is what closes that gap without
 * making every route round-trip its title through `loaderData`.
 */
describe("a route's translator", () => {
  it("translates a full dotted key", async () => {
    const t = await pluginRouteTranslator(specWith(["@acme/notes.home"]), {
      locale: "pl",
      queryClient: clientWith(NOTES),
    });

    expect(t("@acme/notes.home.title")).toBe("Notatki");
  });

  it("interpolates values", async () => {
    const t = await pluginRouteTranslator(specWith(["@acme/notes.home"]), {
      locale: "pl",
      queryClient: clientWith(NOTES),
    });

    expect(t("@acme/notes.home.greeting", { name: "Ada" })).toBe("Cześć Ada");
  });

  /**
   * The messages are already in the cache - the loader warms them before `load`
   * runs, and `head` runs after the loader - so a translator costs a cache read
   * and never a request.
   */
  it("asks for exactly the namespaces the route declared", async () => {
    const queryClient = clientWith(NOTES);

    await pluginRouteTranslator(specWith(["@acme/notes.home"]), {
      locale: "pl",
      queryClient,
    });

    expect(queryClient.query).toHaveBeenCalledTimes(1);
    expect(
      (queryClient.query as unknown as ReturnType<typeof vi.fn>).mock
        .calls[0][0].queryKey,
      // Exactly what the spec carries: `core.global` is added upstream, by
      // `pluginRouteMessageNamespaces`, not here.
    ).toEqual(["vitnode", "intl", "pl", "@acme/notes.home"]);
  });

  /**
   * Echoing the key back would put `@acme/notes.home.title` in a `<title>` and
   * nothing would surface it until somebody read a search result.
   */
  it("refuses to translate for a route that declared no messages", async () => {
    const t = await pluginRouteTranslator(specWith([]), {
      locale: "pl",
      queryClient: clientWith(NOTES),
    });

    expect(() => t("@acme/notes.home.title")).toThrow(/declares no `messages`/);
  });

  it("names the namespace to add when it refuses", async () => {
    const t = await pluginRouteTranslator(specWith([]), {
      locale: "pl",
      queryClient: clientWith(NOTES),
    });

    expect(() => t("@acme/notes.home.title")).toThrow(/@acme\/notes\.home/);
  });
});
