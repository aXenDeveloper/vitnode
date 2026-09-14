export const routeSlugFor = (pluginName: string): string =>
  pluginName.includes("/")
    ? pluginName.slice(pluginName.indexOf("/") + 1)
    : pluginName;

export const pluginConstTemplate = (pluginName: string): string =>
  `export const CONFIG_PLUGIN = {
  pluginId: "${pluginName}" as const,
};
`;

export const pluginRoutesTemplate = (pluginName: string): string => {
  const slug = routeSlugFor(pluginName);

  return `import { definePluginRoutes, lazy, page } from "@vitnode/core/routing";

export const routes = definePluginRoutes([
  page("/${slug}", {
    component: lazy(() => import("./pages/home-page")),
  }),
]);
`;
};

/**
 * `src/pages/home-page.tsx` - the page itself.
 *
 * A default export and a `route` whose loader calls the plugin's own endpoint
 * through the universal fetcher: rendered on the server for the first visit,
 * fetched in the browser on a navigation, from one call.
 */
export const pluginRouteModuleTemplate = (pluginName: string): string =>
  `import type { PluginRoutePageProps } from "@vitnode/core/routing";

import { definePluginRoute } from "@vitnode/core/routing";
import { useTranslations } from "use-intl";

import { helloApi } from "@/api/client";

interface HelloMessage {
  message: string;
}

export const route = definePluginRoute<HelloMessage>({
  load: async () => {
    const response = await helloApi.fetch({
      method: "get",
      module: "hello",
      path: "/",
    });

    return await response.json();
  },
});

const HomePage = ({ loaderData }: PluginRoutePageProps<HelloMessage>) => {
  const t = useTranslations("${pluginName}");

  return (
    <div className="container mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold tracking-tight text-balance">
        {t("home.title")}
      </h1>

      <p className="text-muted-foreground leading-relaxed text-pretty">
        {t("home.desc")}
      </p>

      <div className="bg-card text-card-foreground flex flex-col gap-1 rounded-lg border p-4">
        <span className="text-muted-foreground text-sm">{t("home.api")}</span>
        <span className="font-medium">{loaderData.message}</span>
      </div>
    </div>
  );
};

export default HomePage;
`;

/**
 * `src/locales/en.json` - the strings the page above renders.
 *
 * Every key sits under the plugin's own name. A top-level key outside it
 * collides with core and with every other plugin, and VitNode ignores it - which
 * is why the namespace is the package name rather than something shorter.
 */
export const pluginMessagesTemplate = (pluginName: string): string =>
  `${JSON.stringify(
    {
      [pluginName]: {
        home: {
          api: "Your plugin's API answered:",
          desc: "This page ships inside the plugin and is served by the app that installed it.",
          title: "Hello from your plugin",
        },
      },
    },
    null,
    2,
  )}\n`;

/**
 * `src/locales/index.ts` - the barrel `config.tsx` registers.
 *
 * A map of loaders rather than of objects, so an app pays for the languages it
 * serves and no others.
 */
export const pluginMessagesBarrelTemplate = (): string =>
  `import type { LocaleMessagesMap } from "@vitnode/core/lib/i18n/types";

const messages: LocaleMessagesMap = {
  en: async () => await import("./en.json", { with: { type: "json" } }),
};

export default messages;
`;

/**
 * The exported factory's name - `@acme/my-blog` becomes `myBlogPlugin`.
 *
 * A separate function because it is the one part of the config template that is
 * a transformation rather than a substitution, and the one worth asserting on
 * its own: a package name is kebab-case and scoped, and neither survives being
 * pasted into an identifier.
 */
export const pluginVariableName = (pluginName: string): string => {
  const camel = routeSlugFor(pluginName)
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part, index) =>
      index === 0 ? part : `${part[0].toUpperCase()}${part.slice(1)}`,
    )
    .join("");

  // A package name may start with a digit; an identifier may not.
  const safe = /^[A-Za-z]/.test(camel) ? camel : `vitnode${camel}`;

  // Most plugins are called something-plugin, and appending unconditionally
  // gives them `myVitnodePluginPlugin`. Stripped rather than skipped, so the
  // suffix is spelled the same way whatever the package name did.
  const stem = safe.replace(/plugin$/i, "");

  return `${stem === "" ? safe : stem}Plugin`;
};

/**
 * `src/config.tsx` - what an application registers.
 *
 * The routes, the locale files and the messages, and nothing else. `routes` is
 * the same tree `routes.ts` exports, handed on unchanged: an app on Vite reads
 * that file directly at build time and an app that registers the plugin the
 * ordinary way reads it through here, so the two paths cannot describe
 * different routes.
 *
 * `localeFiles` is the same list as the barrel above it, spelled as specifiers
 * rather than as loaders: an app's build writes its own loaders from it, and a
 * literal package subpath is the only form its bundler can resolve.
 */
export const pluginConfigTemplate = (pluginName: string): string =>
  `import { buildPlugin } from "@vitnode/core/lib/plugin";

import { CONFIG_PLUGIN } from "@/const";

import messages from "./locales";
import { routes } from "./routes";

export const ${pluginVariableName(pluginName)} = () =>
  buildPlugin({
    pluginId: CONFIG_PLUGIN.pluginId,
    localeFiles: {
      en: "${pluginName}/locales/en.json",
    },
    messages,
    routes,
  });
`;

export const pluginApiVariableName = (pluginName: string): string =>
  pluginVariableName(pluginName).replace(/Plugin$/, "ApiPlugin");

export const pluginApiRouteTemplate = (): string =>
  `import { z } from "@hono/zod-openapi";
import { buildRoute } from "@vitnode/core/api/lib/route";

import { CONFIG_PLUGIN } from "@/const";

export const helloRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    path: "/",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ message: z.string() }),
          },
        },
        description: "A greeting from the plugin.",
      },
    },
  },
  handler: c => c.json({ message: \`Hello from \${CONFIG_PLUGIN.pluginId}!\` }),
});
`;

export const pluginApiModuleTemplate = (): string =>
  `import { buildModule } from "@vitnode/core/api/lib/module";

import { CONFIG_PLUGIN } from "@/const";

import { helloRoute } from "./hello.route";

export const helloModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "hello",
  routes: [helloRoute],
});
`;

export const pluginApiClientTemplate = (): string =>
  `import type { ApiClient } from "@vitnode/core/tanstack/fetcher";

import { createApiClient } from "@vitnode/core/tanstack/fetcher";

import type { helloModule } from "@/api/modules/hello/hello.module";

import { CONFIG_PLUGIN } from "@/const";

export const helloApi: ApiClient<typeof helloModule> = createApiClient<
  typeof helloModule
>(CONFIG_PLUGIN.pluginId);
`;

export const pluginApiConfigTemplate = (pluginName: string): string =>
  `import { buildApiPlugin } from "@vitnode/core/api/lib/plugin";

import { CONFIG_PLUGIN } from "@/const";

import { helloModule } from "./api/modules/hello/hello.module";

export const ${pluginApiVariableName(pluginName)} = () =>
  buildApiPlugin({
    pluginId: CONFIG_PLUGIN.pluginId,
    modules: [helloModule],
  });
`;

/**
 * What an app may import from this plugin.
 *
 * `"./*"` maps every subpath to the build output, so `routes` is imported as
 * `<name>/routes` and resolves to `dist/src/routes.js`. An app resolves it
 * exactly as a published install would - there is no deep source import
 * anywhere in the path - and the pages that tree names are reached from inside
 * it, relative to that same `dist`.
 *
 * `"./locales/*.json"` is separate and points at **source**, because it maps
 * to JSON that is copied rather than compiled: `dist/src/locales/en.json`
 * exists, but the export has to name a `.json` subpath and the wildcard
 * above would rewrite the extension. Without this an app can import the
 * plugin's pages and not its strings.
 */
export const pluginPackageExports = (): Record<
  string,
  Record<string, string> | string
> => ({
  "./locales/*.json": "./src/locales/*.json",
  "./*": {
    import: "./dist/src/*.js",
    types: "./dist/src/*.d.ts",
    default: "./dist/src/*.js",
  },
});

/** Every file the routing scaffold writes, keyed by its path inside the plugin. */
export const pluginRouteScaffold = (
  pluginName: string,
): Record<string, string> => ({
  "src/api/client.ts": pluginApiClientTemplate(),
  "src/api/modules/hello/hello.module.ts": pluginApiModuleTemplate(),
  "src/api/modules/hello/hello.route.ts": pluginApiRouteTemplate(),
  "src/config.api.ts": pluginApiConfigTemplate(pluginName),
  "src/config.tsx": pluginConfigTemplate(pluginName),
  "src/const.ts": pluginConstTemplate(pluginName),
  "src/locales/en.json": pluginMessagesTemplate(pluginName),
  "src/locales/index.ts": pluginMessagesBarrelTemplate(),
  "src/pages/home-page.tsx": pluginRouteModuleTemplate(pluginName),
  "src/routes.ts": pluginRoutesTemplate(pluginName),
});
