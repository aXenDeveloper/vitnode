"use client";

import {
  Outlet,
  useLoaderData,
  useNavigate,
  useParams,
} from "@tanstack/react-router";
import {
  createElement,
  Suspense,
  useCallback,
  useSyncExternalStore,
} from "react";

import type { CheckedPluginRouteModule } from "@/routing";

import type { RouteBreadcrumbProps } from "../breadcrumb/model";
import type { RuntimePluginRoutePageProps } from "./loader-data";
import type { PluginRouteModuleRef } from "./module-ref";

import { RouteMessages } from "../i18n/route-messages";
import {
  pluginRouteLoaderData,
  pluginRoutePageProps,
  pluginRouteSearch,
} from "./loader-data";

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
/**
 * A `navigate` that replaces this page's query string and nothing else.
 *
 * `useNavigate()` unbound, called with no `to`, which is TanStack's own spelling
 * of "stay where you are and change the search" - the same call the host's own
 * route files make through `Route.useNavigate()`. Handing a plugin the router's
 * navigate whole would hand it the route table with it; this is the one shape
 * that means the same thing under any router, so it is the only one that
 * crosses.
 */
const usePluginRouteNavigate = (): RuntimePluginRoutePageProps["navigate"] => {
  const navigate = useNavigate();

  return useCallback(
    async ({ resetScroll, search }) => {
      await navigate({
        ...(resetScroll === undefined ? {} : { resetScroll }),
        search,
      } as Parameters<typeof navigate>[0]);
    },
    [navigate],
  );
};

const usePluginRoutePageProps = () =>
  pluginRoutePageProps(
    useLoaderData({ strict: false }),
    useParams({ strict: false }),
    usePluginRouteNavigate(),
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
 * A plugin route's own crumb, rendered in the shell's trail.
 *
 * Every plugin route declares this one component and the shell collects one item
 * per matched route, so a page inside two layouts contributes the third crumb of
 * three and never restates the two above it. What the plugin's own component
 * returns is the label; the separator, the `aria-current`, the locale-aware link
 * to this route's URL and the position in the trail are all the shell's.
 *
 * ## The provider, and why it is here rather than in the plugin
 *
 * The shell renders the breadcrumb *above* the outlet, so a crumb is outside its
 * own route's message provider - a translated crumb that mounted none would
 * render its message key. Every VitNode crumb therefore mounts its own
 * `RouteMessages`, which is what `SettingsBreadcrumb` does by hand; a plugin
 * cannot, because `RouteMessages` is a TanStack component and a plugin route
 * module may not import one. So the runtime mounts it, with the namespaces of
 * the route that declared the crumb - the same list that route's loader already
 * warmed, so it reads a cache entry rather than fetching one.
 *
 * `Suspense` around it because the loader warms the messages and the module in
 * parallel: if the module wins that race the crumb can render a moment before
 * its strings exist, and a suspend here would blank the header rather than the
 * page. A crumb that arrives a frame late is the right trade.
 *
 * ## Why it may not suspend on the module itself
 *
 * Same reason. It reads what has already arrived (`ref.current`) and subscribes
 * for the rest: before the module resolves it renders nothing, and the moment it
 * does it renders the crumb. `useSyncExternalStore` is exactly this, including
 * the case a plainer implementation gets wrong - a module that resolves between
 * the first render and the subscription.
 *
 * The chunk is never fetched *for* the breadcrumb, and never split from the page
 * it belongs to: the ref is the same memoised import the route's component and
 * loader are already waiting on.
 */
export const pluginRouteBreadcrumb = (
  module: PluginRouteModuleRef,
  namespaces: readonly string[],
): React.FunctionComponent<RouteBreadcrumbProps> => {
  // Defined once per route rather than per render, which is what
  // `useSyncExternalStore` needs of them - and there is nothing reactive to
  // depend on: one component is built per module.
  const subscribe = (listener: () => void) => module.subscribe(listener);
  const snapshot = () => module.current?.route.breadcrumb;

  return function PluginRouteBreadcrumb(props: RouteBreadcrumbProps) {
    const Breadcrumb = useSyncExternalStore(subscribe, snapshot, snapshot);

    if (!Breadcrumb) return null;

    return (
      <Suspense>
        {withMessages(
          namespaces,
          createElement(Breadcrumb, {
            loaderData: pluginRouteLoaderData(props.loaderData),
            params: props.params,
            search: pluginRouteSearch(props.loaderData),
          }),
        )}
      </Suspense>
    );
  };
};
