import { createRoute as createRouteHono, OpenAPIHono } from "@hono/zod-openapi";

import type { BuildCronReturn } from "./cron";
import type { Route } from "./route";

import { captchaMiddleware } from "../middlewares/captcha.middleware";
import { pluginMiddleware } from "../middlewares/global.middleware";

export interface BuildModuleType<T extends Route, Plugin extends string> {
  plugin: Plugin;
  routes: T;
}

export interface BaseBuildModuleReturn<
  P extends string = string,
  M extends string = string,
  Routes extends Route[] = Route[],
> {
  cronJobs: BuildCronReturn[];
  hono: OpenAPIHono;
  modules?: BaseBuildModuleReturn<P>[];
  name: M;
  pluginId: P;
  routes: Routes;
}

export interface BuildModuleReturn<
  P extends string,
  M extends string,
  Routes extends Route[] = Route[],
  Modules extends BaseBuildModuleReturn<P>[] | undefined =
    | BaseBuildModuleReturn<P>[]
    | undefined,
> extends BaseBuildModuleReturn<P, M, Routes> {
  modules?: Modules;
}

type InferBuiltModules<
  Modules extends BuildModuleDefinition<string>[] | undefined,
> = Modules extends BuildModuleDefinition<string>[]
  ? ReturnType<Modules[number]["build"]>[]
  : [];

export interface BuildModuleDefinition<
  M extends string,
  Routes extends Route[] = Route[],
  Modules extends BuildModuleDefinition<string>[] | undefined =
    | BuildModuleDefinition<string>[]
    | undefined,
> {
  build: <P extends string>(
    pluginId: P,
  ) => BuildModuleReturn<P, M, Routes, InferBuiltModules<Modules>>;
  cronJobs: BuildCronReturn[];
  modules?: Modules;
  name: M;
  routes: Routes;
}

export function buildModule<
  const M extends string,
  const Routes extends Route[],
  Modules extends BuildModuleDefinition<string>[] | undefined,
>({
  routes,
  name,
  modules,
  cronJobs = [],
}: {
  cronJobs?: BuildCronReturn[];
  modules?: Modules;
  name: M;
  routes: Routes;
}): BuildModuleDefinition<M, Routes, Modules> {
  return {
    routes,
    name,
    modules,
    cronJobs,
    build<P extends string>(pluginId: P) {
      const hono = new OpenAPIHono();

      if (routes) {
        routes.forEach(({ handler, route }) => {
          const pluginTag = pluginId
            .split(/[-_]/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");

          const tags = [pluginTag, ...(route.tags ?? [])];

          const middleware = [
            pluginMiddleware(pluginId),
            ...(route.withCaptcha ? [captchaMiddleware()] : []),
            ...(Array.isArray(route.middleware)
              ? route.middleware
              : route.middleware
                ? [route.middleware]
                : []),
          ];

          const honoRoute = createRouteHono({
            ...route,
            middleware,
            tags,
          });

          hono.openapi(honoRoute as Route["route"], handler);
        });
      }

      let builtModules = [] as InferBuiltModules<Modules>;

      if (modules) {
        builtModules = modules.map(module =>
          module.build(pluginId),
        ) as InferBuiltModules<Modules>;

        builtModules?.forEach(module => {
          hono.route(`/${module.name}`, module.hono);
        });
      }

      return {
        routes,
        pluginId,
        hono,
        name,
        modules: builtModules,
        cronJobs,
      } as BuildModuleReturn<P, M, Routes, InferBuiltModules<Modules>>;
    },
  };
}
