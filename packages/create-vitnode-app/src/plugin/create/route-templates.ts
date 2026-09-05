export const routeSlugFor = (pluginName: string): string =>
  pluginName.includes("/")
    ? pluginName.slice(pluginName.indexOf("/") + 1)
    : pluginName;

export const pluginRoutesTemplate = (pluginName: string): string => {
  const slug = routeSlugFor(pluginName);

  return `import { definePluginRoutes, lazy, page } from "@vitnode/core/routing";

/**
 * The routes this plugin contributes to whatever app installs it.
 *
 * Browser-safe data: a path, and the module that renders it. \`lazy\` keeps that
 * \`import()\` a literal the bundler can follow *without running it*, so your page
 * gets a chunk of its own and is fetched when somebody navigates to it - not
 * before. Never import a page into this file: a component named here is in the
 * initial bundle of every page on the site, which is why VitNode refuses one.
 *
 * Your page is never copied into the application either. The app holds one static
 * import of this tree, and nothing else.
 *
 * Add a route by adding a \`page()\`. \`path\` is the public URL, written in
 * VitNode's own spelling: a dynamic segment is \`:id\`, never Next's \`[id]\` and
 * never TanStack's \`$id\`. To nest pages inside a shared frame, wrap them in a
 * \`layout()\` and give each child a path relative to it.
 */
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
 * Deliberately the *minimum* module: a default export and nothing else. A route
 * module may also export a `route` for its loader, metadata and breadcrumb, and
 * the comment says where to read about that rather than scaffolding an empty one
 * - a generated `route = definePluginRoute({})` would be a thing to delete.
 */
export const pluginRouteModuleTemplate = (pluginName: string): string =>
  `import { useTranslations } from "use-intl";


const HomePage = () => {
  const t = useTranslations("${pluginName}");

  return (
    <div className="container mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold tracking-tight text-balance">
        {t("home.title")}
      </h1>

      <p className="text-muted-foreground leading-relaxed text-pretty">
        {t("home.desc")}
      </p>
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
 * The routes and the messages, and nothing else. `routes` is the same tree
 * `routes.ts` exports, handed on unchanged: an app on Vite reads that file
 * directly at build time and an app that registers the plugin the ordinary way
 * reads it through here, so the two paths cannot describe different routes.
 */
export const pluginConfigTemplate = (pluginName: string): string =>
  `import { buildPlugin } from "@vitnode/core/lib/plugin";

import messages from "./locales";
import { routes } from "./routes";


export const ${pluginVariableName(pluginName)} = () =>
  buildPlugin({
    pluginId: "${pluginName}",
    messages,
    routes,
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
  "src/config.tsx": pluginConfigTemplate(pluginName),
  "src/locales/en.json": pluginMessagesTemplate(pluginName),
  "src/locales/index.ts": pluginMessagesBarrelTemplate(),
  "src/pages/home-page.tsx": pluginRouteModuleTemplate(pluginName),
  "src/routes.ts": pluginRoutesTemplate(pluginName),
});
