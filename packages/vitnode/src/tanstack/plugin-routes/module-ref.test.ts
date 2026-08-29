import { describe, expect, it, vi } from "vitest";

import { pluginRoutePageProps } from "./loader-data";
import { pluginRouteModuleRef } from "./module-ref";

/**
 * One plugin route's module: imported once, checked, and readable by the four
 * things that need it at four different moments.
 *
 * No React and no router. What is asserted is the memo, the synchronous peek,
 * the notification and the diagnostic - all of which are decided before anything
 * renders, and none of which a component test would exercise any better.
 */

const page = () => null;

describe("pluginRouteModuleRef", () => {
  it("imports the module once, however many callers ask for it", async () => {
    const load = vi.fn(async () => Promise.resolve({ default: page }));
    const ref = pluginRouteModuleRef(load, "plugin:page");

    const [first, second] = await Promise.all([ref(), ref()]);
    await ref();

    expect(load).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
    expect(first.component).toBe(page);
  });

  it("checks the module rather than trusting it, naming the route", async () => {
    const ref = pluginRouteModuleRef(
      async () => Promise.resolve({ default: "not a component" }),
      "plugin:page",
    );

    await expect(ref()).rejects.toThrow(/plugin:page/);
  });

  it("rejects a `route` export that is not an object of functions", async () => {
    const ref = pluginRouteModuleRef(
      async () => Promise.resolve({ default: page, route: { head: "no" } }),
      "plugin:page",
    );

    await expect(ref()).rejects.toThrow(/route\.head/);
  });

  /**
   * A failed *import* is a network failure, not a broken plugin, so the memo is
   * cleared and the next navigation tries again. A malformed module fails the
   * same way and will keep failing, which is correct: the module is wrong.
   */
  it("retries after a failed import instead of answering from the failure", async () => {
    const load = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ default: page });
    const ref = pluginRouteModuleRef(load, "plugin:page");

    await expect(ref()).rejects.toThrow("offline");
    await expect(ref()).resolves.toMatchObject({ component: page });
    expect(load).toHaveBeenCalledTimes(2);
  });

  /**
   * The synchronous half, for the breadcrumb: it renders in the shell, above the
   * route's own Suspense boundary, so it may read what has arrived but may never
   * await it.
   */
  it("reads nothing before the module arrives, and the module after", async () => {
    const ref = pluginRouteModuleRef(
      async () => Promise.resolve({ default: page }),
      "plugin:page",
    );

    expect(ref.current).toBeUndefined();
    await ref();
    expect(ref.current?.component).toBe(page);
  });

  it("tells a subscriber when the module arrives, and stops when unsubscribed", async () => {
    const listener = vi.fn();
    const ref = pluginRouteModuleRef(
      async () => Promise.resolve({ default: page }),
      "plugin:page",
    );

    const unsubscribe = ref.subscribe(listener);
    await ref();

    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();

    const other = pluginRouteModuleRef(
      async () => Promise.resolve({ default: page }),
      "plugin:other",
    );
    const stop = other.subscribe(listener);

    stop();
    await other();

    expect(listener).toHaveBeenCalledTimes(1);
  });
});

/**
 * A loader's envelope, as the props a plugin page is rendered with.
 *
 * The three names match `load`'s and `head`'s arguments, which is the reason it
 * is an envelope rather than the loader's data spread flat - and why a loader
 * that returned a string still produces a complete props object.
 */
describe("pluginRoutePageProps", () => {
  const params = { topic: "routing" };

  it("hands the loader's own data back under `loaderData`", () => {
    expect(
      pluginRoutePageProps(
        { data: { title: "Guide" }, search: { q: "x" } },
        params,
      ),
    ).toEqual({ loaderData: { title: "Guide" }, params, search: { q: "x" } });
  });

  it("keeps a loader result that is not an object", () => {
    expect(pluginRoutePageProps({ data: "plain", search: {} }, params)).toEqual(
      {
        loaderData: "plain",
        params,
        search: {},
      },
    );
  });

  it.each([
    ["a module with no loader", { data: undefined, search: {} }],
    ["nothing at all", undefined],
  ])("still produces every prop for %s", (_label, loaderData) => {
    expect(pluginRoutePageProps(loaderData, params)).toEqual({
      loaderData: undefined,
      params,
      search: {},
    });
  });
});
