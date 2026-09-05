import { describe, expect, it, vi } from "vitest";

import { pluginRoutePageProps } from "./loader-data";
import { pluginRouteModuleRef } from "./module-ref";

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

describe("pluginRoutePageProps", () => {
  const params = { topic: "routing" };
  /**
   * The runtime's own, in the component. It is passed through untouched, so
   * every assertion below names the identity rather than a shape.
   */
  const navigate = async () => {
    await Promise.resolve();
  };

  it("hands the loader's own data back under `loaderData`", () => {
    expect(
      pluginRoutePageProps(
        { data: { title: "Guide" }, search: { q: "x" } },
        params,
        navigate,
      ),
    ).toEqual({
      loaderData: { title: "Guide" },
      navigate,
      params,
      search: { q: "x" },
    });
  });

  it("keeps a loader result that is not an object", () => {
    expect(
      pluginRoutePageProps({ data: "plain", search: {} }, params, navigate),
    ).toEqual({
      loaderData: "plain",
      navigate,
      params,
      search: {},
    });
  });

  it.each([
    ["a module with no loader", { data: undefined, search: {} }],
    ["nothing at all", undefined],
  ])("still produces every prop for %s", (_label, loaderData) => {
    expect(pluginRoutePageProps(loaderData, params, navigate)).toEqual({
      loaderData: undefined,
      navigate,
      params,
      search: {},
    });
  });
});
