import type { CheckedPluginRouteModule } from "@/routing";

import { readPluginRouteModule } from "@/routing";

/**
 * One plugin route's module, imported at most once and readable three ways.
 *
 * A plugin route's chunk is wanted by four different things at four different
 * moments - the router's own `component.preload()`, the route's loader, its
 * `head`, and the shell's breadcrumb - and every one of them is on the critical
 * path of the same navigation. Four calls to the route's own `lazy()` callback
 * would be four `import()` expressions of the same specifier: the bundler
 * dedupes the *fetch*, but each caller would still run
 * {@link readPluginRouteModule} again and hold its own copy of the answer, and
 * the breadcrumb - which renders while the match is still pending - would have
 * no way to find out that one of the others had finished.
 *
 * So the import is memoised here, once per route, and exposed as the three
 * shapes those callers actually need:
 *
 *     ref()          the promise - for a loader or a `head`, which may await
 *     ref.current    what has already arrived - for a render, which may not
 *     ref.subscribe  and how to hear when it does
 *
 * A rejected import clears the memo, so the next navigation retries rather than
 * being answered forever from a failure the visitor has since fixed by
 * reloading. A *malformed* module rejects the same way and will keep rejecting,
 * which is correct: the module is wrong, and the error names the route.
 */
export interface PluginRouteModuleRef {
  (): Promise<CheckedPluginRouteModule>;
  /**
   * The module, if it has already arrived - and never a promise.
   *
   * For the one caller that cannot await: a component rendering inside the
   * shell, above the route's own Suspense boundary, where suspending would blank
   * the header rather than the page.
   */
  readonly current: CheckedPluginRouteModule | undefined;
  /** Fires once, when {@link PluginRouteModuleRef.current} becomes readable. */
  subscribe: (listener: () => void) => () => void;
}

/**
 * A memoised, checked loader for one plugin route module.
 *
 * A `lazy()` callback is typed `() => Promise<unknown>` here deliberately - what
 * a page module is expected to export is checked rather than assumed - so this
 * is where that `unknown` is turned into something a router can be handed, by
 * `readPluginRouteModule`, which throws with the route id in the message.
 * Without it the failure is React's "type is invalid" from inside a lazy
 * component, three frames from the plugin that caused it.
 */
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
