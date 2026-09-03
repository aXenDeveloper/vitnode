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
