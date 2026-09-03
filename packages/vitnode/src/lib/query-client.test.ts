// @vitest-environment node
import { describe, expect, it } from "vitest";

import { createVitNodeQueryClient } from "./query-client";

describe("createVitNodeQueryClient", () => {
  it("does not refetch on mount or window focus", () => {
    const { queries } = createVitNodeQueryClient().getDefaultOptions();

    expect(queries?.refetchOnMount).toBe(false);
    expect(queries?.refetchOnWindowFocus).toBe(false);
  });

  it("declares refetch-on-reconnect rather than inheriting it", () => {
    const { queries } = createVitNodeQueryClient().getDefaultOptions();

    expect(queries?.refetchOnReconnect).toBe(true);
  });

  it("does not retry reads by default", () => {
    const { queries } = createVitNodeQueryClient().getDefaultOptions();

    expect(queries?.retry).toBe(false);
  });

  it("leaves no automatic refetch trigger undeclared", () => {
    const { queries } = createVitNodeQueryClient().getDefaultOptions();

    for (const trigger of [
      "refetchOnMount",
      "refetchOnReconnect",
      "refetchOnWindowFocus",
    ] as const) {
      expect(queries?.[trigger], trigger).toBeTypeOf("boolean");
    }
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
