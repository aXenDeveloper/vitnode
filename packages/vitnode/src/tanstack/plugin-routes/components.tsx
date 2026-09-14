import {
  Outlet,
  useLoaderData,
  useNavigate,
  useParams,
} from "@tanstack/react-router";
import { createElement, Suspense, useCallback } from "react";

import type {
  CheckedPluginRouteModule,
  PluginRouteBreadcrumbGroup,
  PluginRouteBreadcrumbProps,
} from "@/routing";

import type {
  RouteBreadcrumbDeferred,
  RouteBreadcrumbProps,
} from "../breadcrumb/model";
import type { RuntimePluginRoutePageProps } from "./loader-data";
import type { PluginRouteModuleRef } from "./module-ref";

import { breadcrumbDeferred } from "../breadcrumb/model";
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
      // because it is the layout's own prop - the plugin declares it - and it is
      // applied last so a loader that returned a key of that name cannot
      // displace the outlet.
      createElement(Layout, {
        ...usePluginRoutePageProps(),
        // eslint-disable-next-line @eslint-react/jsx-no-children-prop
        children: <Outlet />,
      }),
    );
  };
};

/** A crumb the module actually draws: the component half of either spelling. */
type DeclaredBreadcrumb = React.ComponentType<
  PluginRouteBreadcrumbProps<unknown>
>;

const isBreadcrumbGroup = (
  value: unknown,
): value is PluginRouteBreadcrumbGroup =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as PluginRouteBreadcrumbGroup).group === "function";

export const pluginRouteBreadcrumb = (
  module: PluginRouteModuleRef,
  namespaces: readonly string[],
): RouteBreadcrumbDeferred => {
  let built:
    | undefined
    | {
        component: React.FunctionComponent<RouteBreadcrumbProps>;
        declared: DeclaredBreadcrumb;
      };

  const componentFor = (declared: DeclaredBreadcrumb) => {
    if (built?.declared !== declared) {
      built = {
        component: function PluginRouteBreadcrumb(props: RouteBreadcrumbProps) {
          return (
            <Suspense>
              {withMessages(
                namespaces,
                createElement(declared, {
                  loaderData: pluginRouteLoaderData(props.loaderData),
                  params: props.params,
                  search: pluginRouteSearch(props.loaderData),
                }),
              )}
            </Suspense>
          );
        },
        declared,
      };
    }

    return built.component;
  };

  return breadcrumbDeferred(
    () => {
      const declared = module.current?.route.breadcrumb;

      // `undefined` is "the module has not arrived yet, ask again"; `false` and
      // `null` are both "this route contributes no crumb". They are kept apart
      // here because only the first is worth re-resolving.
      if (declared === undefined) return undefined;
      if (declared === false || declared === null) return false;

      // A group draws its own `<BreadcrumbItem>`s, so it stays a group all the
      // way to the trail - wrapping it in one would nest items inside an item.
      // Only the component inside it is wrapped, and it is wrapped the same way
      // a plain crumb is.
      return isBreadcrumbGroup(declared)
        ? { group: componentFor(declared.group) }
        : componentFor(declared);
    },
    listener => module.subscribe(listener),
  );
};
