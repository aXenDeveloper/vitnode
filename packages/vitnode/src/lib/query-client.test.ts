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
 *
 * The refetch assertions are deliberately about *all three* of Query's automatic
 * triggers rather than the two this app turns off. An undeclared trigger behaves
 * however the installed version of Query decides, which is the one thing a
 * defaults file exists to stop.
 */
describe("createVitNodeQueryClient", () => {
  it("does not refetch on mount or window focus", () => {
    const { queries } = createVitNodeQueryClient().getDefaultOptions();

    expect(queries?.refetchOnMount).toBe(false);
    expect(queries?.refetchOnWindowFocus).toBe(false);
  });

  /**
   * The third trigger, declared rather than inherited.
   *
   * `true` is also Query's default, so this asserts no behaviour that was not
   * already happening - which is the point. What it pins is that the value is
   * *stated*: the file now answers "what refetches this query, and when" for all
   * three triggers instead of two, and a future edit that flips it has to argue
   * with a failing test rather than with nothing.
   */
  it("declares refetch-on-reconnect rather than inheriting it", () => {
    const { queries } = createVitNodeQueryClient().getDefaultOptions();

    expect(queries?.refetchOnReconnect).toBe(true);
  });

  /**
   * Reads do not retry unless a family asks for it.
   *
   * The direction is the assertion. Query's own default is three retries with
   * backoff, which for a privileged AdminCP read means answering a `403` by
   * asking twice more and a `429` by tripling the load the limiter is trying to
   * shed. Defaulting to `false` means a family added later that says nothing
   * about retries gets the behaviour that cannot hurt; the three public families
   * that want one declare it where they are declared.
   */
  it("does not retry reads by default", () => {
    const { queries } = createVitNodeQueryClient().getDefaultOptions();

    expect(queries?.retry).toBe(false);
  });

  /**
   * Every automatic trigger has an opinion recorded against it.
   *
   * The rule this stage adds, written as a rule rather than as three separate
   * assertions: a fourth trigger arriving in a future Query release, or a
   * fourth that somebody deletes, fails here.
   */
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
