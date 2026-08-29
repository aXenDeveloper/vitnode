"use client";

import { Outlet, useLoaderData, useParams } from "@tanstack/react-router";
import {
  createElement,
  Suspense,
  useCallback,
  useSyncExternalStore,
} from "react";

import type { CheckedPluginRouteModule } from "@/routing";

import type { PluginRouteModuleRef } from "./module-ref";

import { RouteMessages } from "../i18n/route-messages";
import { pluginRoutePageProps } from "./loader-data";

/**
 * The React half of a plugin route: what actually renders once the module has
 * arrived.
 *
 * Every component here is built *from* a checked module rather than importing
 * one, which is what keeps a plugin's page out of the initial bundle - the
 * factories below are called inside `lazyRouteComponent`'s importer, on the
 * chunk the router fetched, and the component they return is the one thing that
 * ever reaches React.
 */

/**
 * The strings a plugin route renders, provided around it - or nothing.
 *
 * `RouteMessages` mounts a provider that **replaces** the shell's rather than
 * adding to it, so it is mounted only where a route actually declared
 * namespaces: a plugin page that declares none reads the root's provider, which
 * already holds exactly `core.global`, and mounting a second identical one would
 * be a second cache read for the same bytes.
 *
 * Where it is mounted, the list is the route's own namespaces plus its layouts'
 * plus `core.global` - decided in `./specs`, warmed by the loader through the
 * identical `intlQueryOptions`, so this reads a cache entry that is already
 * there and nothing suspends.
 */
const withMessages = (
  namespaces: readonly string[],
  children: React.ReactNode,
): React.ReactElement =>
  namespaces.length === 0 ? (
    // Wrapped rather than returned straight: React 19 types `ReactNode` as
    // including a promise, so a component whose return type is one reads as an
    // async component to every rule that looks for one - and one of those rules
    // will helpfully add the `async` keyword for you.
    <>{children}</>
  ) : (
    <RouteMessages namespaces={namespaces}>{children}</RouteMessages>
  );

/**
 * What this route resolved, read back inside the component the router renders.
 *
 * A route component is rendered with no props of its own, so nothing can be
 * handed down to it - `strict: false` reads the loader data and the params of
 * the match *this* component is rendering, which is this plugin route's own
 * match. See `PluginRoutePageProps` for why the result is an envelope rather
 * than the loader's data spread flat.
 */
const usePluginRoutePageProps = () =>
  pluginRoutePageProps(
    useLoaderData({ strict: false }),
    useParams({ strict: false }),
  );

/**
 * A plugin page, wrapped in whatever the route around it promised.
 *
 * The component is typed at its widest here, because `readPluginRouteModule`
 * checked `typeof module.default === "function"` and nothing more - the props
 * were checked by the plugin's own `satisfies PluginRoutePageModule`, on the
 * plugin's side, at compile time.
 */
export const pluginPageComponent = (
  module: CheckedPluginRouteModule,
  namespaces: readonly string[],
): React.FunctionComponent => {
  const Page = module.component as React.FunctionComponent<
    Record<string, unknown>
  >;

  return function PluginPage() {
    // `createElement` rather than JSX, here and below: the element type comes
    // out of a module rather than being declared in this file, and naming it in
    // render is the thing that reads as a component defined during render.
    return withMessages(
      namespaces,
      createElement(Page, { ...usePluginRoutePageProps() }),
    );
  };
};

/**
 * A plugin layout: the plugin's frame, with the router's outlet inside it.
 *
 * `children` rather than an `<Outlet />` the layout imports, which is the whole
 * of what keeps a layout framework-neutral - an outlet belongs to a router, and
 * a plugin that imported one could be installed into exactly one kind of
 * application. It is passed last so a loader that returned a `children` key
 * cannot displace the routes underneath it.
 *
 * The provider goes *outside* the frame, because the frame renders strings too.
 */
export const pluginLayoutComponent = (
  module: CheckedPluginRouteModule,
  namespaces: readonly string[],
): React.FunctionComponent => {
  const Layout = module.component as React.FunctionComponent<
    Record<string, unknown>
  >;

  return function PluginLayout() {
    return withMessages(
      namespaces,
      // `children` in the props rather than as `createElement`'s third argument
      // because it is the layout's own prop - the plugin declares it, the same
      // way a Next.js `layout.tsx` does - and it is applied last so a loader
      // that returned a key of that name cannot displace the outlet.
      createElement(Layout, {
        ...usePluginRoutePageProps(),
        // eslint-disable-next-line @eslint-react/jsx-no-children-prop
        children: <Outlet />,
      }),
    );
  };
};

/**
 * One candidate for a plugin route's crumb: a module, and the strings it
 * renders in.
 */
export interface PluginRouteCrumb {
  module: PluginRouteModuleRef;
  /** The owning route's own namespace list - see `./specs`. */
  namespaces: readonly string[];
}

/**
 * What a plugin route contributes to the shell's breadcrumb area.
 *
 * Stage 8's rule is "the deepest matched route that declared a crumb wins", read
 * off `staticData` - and a plugin route cannot answer it there, because whether
 * it declares a crumb is in its *module*, which has not been fetched when
 * `staticData` is written. So every plugin route declares this one component
 * instead, handed the chain from itself up through its layouts, and it applies
 * the same rule at render time over what has actually arrived. The outcome is
 * identical to each route having declared its own crumb; what is different is
 * only when the question can be asked.
 *
 * ## The provider, and why it is here rather than in the plugin
 *
 * The shell renders the breadcrumb *above* the outlet, so a crumb is outside its
 * own route's message provider - a translated crumb that mounted none would
 * render its message key. Every VitNode crumb therefore mounts its own
 * `RouteMessages`, which is what `SettingsBreadcrumb` does by hand; a plugin
 * cannot, because `RouteMessages` is a TanStack component and a plugin route
 * module may not import one. So the runtime mounts it, with the namespaces of
 * the route that *declared* the crumb - the same list that route's loader
 * already warmed, so it reads a cache entry rather than fetching one.
 *
 * `Suspense` around it because the loader warms the messages and the module in
 * parallel: if the module wins that race the crumb can render a moment before
 * its strings exist, and a suspend here would blank the header rather than the
 * page. A crumb that arrives a frame late is the right trade.
 *
 * ## Why it may not suspend on the module itself
 *
 * Same reason. It reads what has already arrived (`ref.current`) and subscribes
 * for the rest: before the modules resolve it renders nothing, and the moment
 * they do it renders the crumb. `useSyncExternalStore` is exactly this,
 * including the case a plainer implementation gets wrong - a module that
 * resolves between the first render and the subscription.
 *
 * The chunk is never fetched *for* the breadcrumb. The refs are the same
 * memoised imports the route's component and loader are already waiting on.
 */
export const PluginRouteBreadcrumb = ({
  crumbs,
}: {
  crumbs: readonly PluginRouteCrumb[];
}) => {
  const subscribe = useCallback(
    (listener: () => void) => {
      const unsubscribes = crumbs.map(crumb =>
        crumb.module.subscribe(listener),
      );

      return () => {
        for (const unsubscribe of unsubscribes) unsubscribe();
      };
    },
    [crumbs],
  );

  // An index rather than the crumb itself, so the snapshot is a primitive that
  // only changes when a module arrives - which is what `useSyncExternalStore`
  // requires of it.
  const snapshot = useCallback(
    () =>
      crumbs.findIndex(
        crumb => crumb.module.current?.route.breadcrumb !== undefined,
      ),
    [crumbs],
  );

  const index = useSyncExternalStore(subscribe, snapshot, snapshot);
  const declared = index < 0 ? undefined : crumbs[index];
  const Breadcrumb = declared?.module.current?.route.breadcrumb;

  if (!declared || !Breadcrumb) return null;

  return (
    <Suspense>
      {withMessages(declared.namespaces, createElement(Breadcrumb))}
    </Suspense>
  );
};
