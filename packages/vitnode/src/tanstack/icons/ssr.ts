import type { AnyRouter } from "@tanstack/react-router";

import type {
  LucideIconCollector,
  LucideIconSnapshot,
} from "@/components/ui/icon-registry";

import {
  createLucideIconCollector,
  preloadAllLucideIcons,
  seedLucideIcons,
} from "@/components/ui/icon-registry";

export interface LucideIconsDehydratedState {
  lucideIcons?: LucideIconSnapshot | Promise<LucideIconSnapshot>;
}

const collectors = new WeakMap<AnyRouter, LucideIconCollector>();

export const lucideIconCollectorOf = (
  router: AnyRouter | undefined,
): LucideIconCollector | undefined =>
  router ? collectors.get(router) : undefined;

const iconsRenderedBy = async (
  router: AnyRouter,
  collector: LucideIconCollector,
): Promise<LucideIconSnapshot> =>
  new Promise(resolve => {
    const settle = () => {
      resolve(collector.snapshot());
    };

    if (!router.serverSsr) {
      settle();

      return;
    }

    router.serverSsr.onRenderFinished(settle);
    router.serverSsr.onCleanup(settle);
  });

export const setupLucideIconSsr = ({ router }: { router: AnyRouter }): void => {
  const collector = createLucideIconCollector();

  collectors.set(router, collector);

  if (router.isServer) {
    const warm = preloadAllLucideIcons();
    const dehydrate = router.options.dehydrate;

    router.options.dehydrate = async () => {
      await warm;

      const lucideIcons = iconsRenderedBy(router, collector);

      return { ...(await dehydrate?.()), lucideIcons };
    };

    return;
  }

  const hydrate = router.options.hydrate;

  router.options.hydrate = async (
    dehydrated: LucideIconsDehydratedState | undefined,
  ) => {
    await hydrate?.(dehydrated);

    const lucideIcons = await dehydrated?.lucideIcons;

    if (lucideIcons) seedLucideIcons(lucideIcons);
  };
};
