// @vitest-environment node
import { describe, expect, it } from "vitest";

import { createVitNodeQueryClient } from "./query-client";

/**
 * The QueryClient every VitNode app runs.
 *
 * Two rules, and both of them are the kind that fails silently. A client shared
 * across server-rendered requests serves one visitor's data to the next, and
 * refetch-on-focus turns any page with a table into one that reloads whenever a
 * tab regains focus - neither shows up in a render test.
 */
describe("createVitNodeQueryClient", () => {
  it("does not refetch on mount or window focus", () => {
    const { queries } = createVitNodeQueryClient().getDefaultOptions();

    expect(queries?.refetchOnMount).toBe(false);
    expect(queries?.refetchOnWindowFocus).toBe(false);
  });

  it("returns a new client per call, so a request never shares one", () => {
    const first = createVitNodeQueryClient();
    const second = createVitNodeQueryClient();

    expect(first).not.toBe(second);
    expect(first.getQueryCache()).not.toBe(second.getQueryCache());

    first.setQueryData(["session"], { user: "someone" });

    expect(second.getQueryData(["session"])).toBeUndefined();
  });

  it("lets a caller add options without losing the defaults", () => {
    const { queries } = createVitNodeQueryClient({
      defaultOptions: { queries: { retry: 3 } },
    }).getDefaultOptions();

    expect(queries?.retry).toBe(3);
    expect(queries?.refetchOnWindowFocus).toBe(false);
  });

  it("lets a caller override a default deliberately", () => {
    const { queries } = createVitNodeQueryClient({
      defaultOptions: { queries: { refetchOnMount: true } },
    }).getDefaultOptions();

    expect(queries?.refetchOnMount).toBe(true);
  });
});
