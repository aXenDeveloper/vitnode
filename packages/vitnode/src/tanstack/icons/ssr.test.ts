// @vitest-environment node
import type { AnyRouter } from "@tanstack/react-router";

import { describe, expect, test, vi } from "vitest";

import { loadLucideIcon, readLucideIcon } from "@/components/ui/icon-registry";

import { lucideIconCollectorOf, setupLucideIconSsr } from "./ssr";

const serverRouter = () => {
  const renderFinished: (() => void)[] = [];
  const router = {
    isServer: true,
    options: { dehydrate: () => ({ docsPagePath: "/docs" }) },
    serverSsr: {
      onCleanup: () => undefined,
      onRenderFinished: (listener: () => void) => {
        renderFinished.push(listener);
      },
    },
  };

  return {
    finishRender: () => {
      for (const listener of renderFinished) listener();
    },
    router: router as unknown as AnyRouter,
  };
};

describe("setupLucideIconSsr on the server", () => {
  test("warms every icon before the render and ships the rendered ones after it", async () => {
    const { finishRender, router } = serverRouter();

    setupLucideIconSsr({ router });

    const collector = lucideIconCollectorOf(router);

    if (!collector) throw new Error("the router must own a collector");

    const dehydrated = (await router.options.dehydrate?.()) as {
      docsPagePath: string;
      lucideIcons: Promise<Record<string, unknown>>;
    };

    expect(dehydrated.docsPagePath).toBe("/docs");
    expect(readLucideIcon("house")?.name).toBe("house");

    const house = readLucideIcon("house");

    if (!house) throw new Error("house must be warm");

    collector.collect("house", house);
    collector.collect("nope", null);

    let settled = false;
    void dehydrated.lucideIcons.then(() => {
      settled = true;
    });

    await Promise.resolve();
    expect(settled).toBe(false);

    finishRender();

    await expect(dehydrated.lucideIcons).resolves.toStrictEqual({
      house,
      nope: null,
    });
  });

  test("resolves right away when no SSR stream is attached", async () => {
    const router = {
      isServer: true,
      options: {},
    } as unknown as AnyRouter;

    setupLucideIconSsr({ router });

    const dehydrated = (await router.options.dehydrate?.()) as {
      lucideIcons: Promise<Record<string, unknown>>;
    };

    await expect(dehydrated.lucideIcons).resolves.toStrictEqual({});
  });
});

describe("setupLucideIconSsr in the browser", () => {
  test("seeds the cache from the dehydrated icons before hydration continues", async () => {
    const hydrate = vi.fn();
    const router = {
      isServer: false,
      options: { hydrate },
    } as unknown as AnyRouter;

    setupLucideIconSsr({ router });

    const camera = await loadLucideIcon("camera");

    if (!camera) throw new Error("camera must resolve");

    const payload = {
      lucideIcons: Promise.resolve({
        "client-only": { ...camera, name: "client-only" },
        missing: null,
      }),
    };

    await router.options.hydrate?.(payload);

    expect(hydrate).toHaveBeenCalledWith(payload);
    expect(readLucideIcon("client-only")?.name).toBe("client-only");
    expect(readLucideIcon("missing")).toBeNull();
    expect(lucideIconCollectorOf(router)).toBeDefined();
  });

  test("tolerates a payload without icons", async () => {
    const router = {
      isServer: false,
      options: {},
    } as unknown as AnyRouter;

    setupLucideIconSsr({ router });

    await expect(router.options.hydrate?.(undefined)).resolves.toBeUndefined();
  });
});
