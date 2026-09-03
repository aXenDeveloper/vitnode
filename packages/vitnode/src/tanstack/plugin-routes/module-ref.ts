import type { CheckedPluginRouteModule } from "@/routing";

import { readPluginRouteModule } from "@/routing";

export interface PluginRouteModuleRef {
  (): Promise<CheckedPluginRouteModule>;

  readonly current: CheckedPluginRouteModule | undefined;
  /** Fires once, when {@link PluginRouteModuleRef.current} becomes readable. */
  subscribe: (listener: () => void) => () => void;
}

export const pluginRouteModuleRef = (
  load: () => Promise<unknown>,
  routeId: string,
): PluginRouteModuleRef => {
  const listeners = new Set<() => void>();

  let current: CheckedPluginRouteModule | undefined;
  let pending: Promise<CheckedPluginRouteModule> | undefined;

  const ref = async (): Promise<CheckedPluginRouteModule> => {
    if (current) return current;

    pending ??= (async () => {
      try {
        const checked = readPluginRouteModule(await load(), routeId);

        current = checked;
        // A copy, because a listener that unsubscribes itself while this runs
        // would otherwise mutate the set being iterated.
        for (const listener of [...listeners]) listener();

        return checked;
      } catch (error) {
        pending = undefined;
        throw error;
      }
    })();

    return pending;
  };

  return Object.defineProperties(ref, {
    current: { get: () => current },
    subscribe: {
      value: (listener: () => void) => {
        listeners.add(listener);

        return () => {
          listeners.delete(listener);
        };
      },
    },
  }) as PluginRouteModuleRef;
};
