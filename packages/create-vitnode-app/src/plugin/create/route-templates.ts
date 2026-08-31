/**
 * The source a scaffolded plugin starts with, as pure functions of its name.
 *
 * Templates as strings rather than as files under `copy-of-vitnode-plugin/`,
 * and the reason is that every one of them has to say the plugin's own name: a
 * route manifest names the module it imports, a page names the message namespace
 * it renders, and `config.tsx` names the plugin id all three are keyed by. A
 * static file cannot, so the scaffold used to copy no `src/` at all - which left
 * a new plugin with a `global.d.ts` importing `./src/locales/en.json` that did
 * not exist, and nothing to point `vitnode dev` at.
 *
 * Pure, and separated from the writing, so what a plugin author is handed can be
 * asserted byte for byte without a filesystem. `route-templates.test.ts` is that
 * assertion; `create-plugin-vitnode.ts` is the half that has a disk.
 *
 * Everything here is the routing path and only the routing path. A scaffolded
 * plugin gets one public page, the strings it renders and the config that
 * registers both - not an API module, not a database table, not a content type.
 * Those have their own guides, and a generator that produced all of them would
 * produce mostly files to delete.
 */

/**
 * The plugin's public URL, and the id it is addressed by.
 *
 * A package name may be scoped and a route path may not be - `/` is a separator
 * in one and a segment break in the other, and `@` is illegal in a VitNode route
 * path outright. The scope is dropped rather than escaped: `@acme/blog` is
 * `blog` on the web, which is what its author would have written anyway.
 *
 * Everything npm allows after the scope is already legal in a static VitNode
 * segment - lowercase letters, digits, `.`, `_`, `-` - so nothing else has to be
 * rewritten, and the name is not silently lowercased: npm rejects an uppercase
 * package name before this is ever reached.
 */
export const routeSlugFor = (pluginName: string): string =>
  pluginName.includes("/")
    ? pluginName.slice(pluginName.indexOf("/") + 1)
    : pluginName;

/**
 * `src/routes/manifest.ts` - the file an app reads to find out this plugin has
 * a page.
 *
 * One route, with the three fields that have no default. Everything else on a
 * `PluginRouteDefinition` - the area, the kind, the parent, the namespaces, the
 * requirement - is left out rather than written with its default value, so what
 * a new plugin's manifest shows is the minimum rather than a form to fill in.
 */
export const pluginRouteManifestTemplate = (pluginName: string): string => {
  const slug = routeSlugFor(pluginName);

  return `import type { PluginRouteDefinition } from "@vitnode/core/routing";

/**
 * The routes this plugin contributes to whatever app installs it.
 *
 * Plain data: an \`entry\` is a *package export subpath*, so
 * \`"routes/home-page"\` is imported as \`"${pluginName}/routes/home-page"\` and
 * resolves through this package's export map to its build output. Nothing here
 * imports a router and nothing here imports a page, so an app can read this list
 * at build time, in Node, without loading a single React component.
 *
 * Your page is never copied into the application. The app generates a literal
 * \`import()\` for it, the bundler gives it its own chunk, and it stays in this
 * package.
 *
 * Add a route by adding a record. \`id\` is a stable name for the page - name it
 * after the page, not the URL, because it survives a path change. \`path\` is the
 * public URL, written in VitNode's own spelling: a dynamic segment is \`:id\`,
 * never \`[id]\` and never \`$id\` - the host converts.
 */
export const routes: PluginRouteDefinition[] = [
  {
    entry: "routes/home-page",
    id: "home",
    path: "/${slug}",
  },
];
`;
};

/**
 * `src/routes/home-page.tsx` - the page itself.
 *
 * Deliberately the *minimum* module: a default export and nothing else. A route
 * module may also export a \`route\` for its loader, metadata and breadcrumb, and
 * the comment says where to read about that rather than scaffolding an empty one
 * - a generated \`route = definePluginRoute({})\` would be a thing to delete.
 */
export const pluginRouteModuleTemplate = (pluginName: string): string =>
  `import { useTranslations } from "use-intl";

/**
 * The page \`routes/manifest.ts\` declares.
 *
 * Keep it framework-neutral. This module is compiled into the package's own
 * \`dist\` and imported by whichever app installed the plugin, so **importing a
 * router pins the plugin to that router** - and so does a host framework's own
 * data or navigation API, or a host-bound i18n package. \`use-intl\` - which is
 * what VitNode itself renders through - and plain JSX are pinned to nothing.
 *
 * No \`<main>\`: the application shell owns the document's one \`main\` landmark,
 * and a page that renders a second gives a screen reader two to choose between.
 * A page owns its container - width, padding, vertical rhythm - and nothing
 * above it.
 *
 * To give this route a loader, page metadata or a breadcrumb, add a \`route\`
 * export beside the default one:
 *
 *     import { definePluginRoute } from "@vitnode/core/routing";
 *
 *     export const route = definePluginRoute({
 *       load: ({ context, params }) => fetchThing(context.locale, params.id),
 *       head: ({ loaderData }) => ({ title: loaderData?.title }),
 *     });
 */
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

/**
 * Every language this plugin ships. Add a file next to this one and a line here
 * to add another; apps pick it up with no copy step, because they read this
 * package's own \`dist\` rather than a copy of it.
 */
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
 * The routes and the messages, and nothing else. `routes` is the same array
 * `routes/manifest.ts` exports, handed on unchanged: an app on Vite reads that
 * file directly at build time and an app that registers the plugin the ordinary
 * way reads it through here, so the two paths cannot describe different routes.
 */
export const pluginConfigTemplate = (pluginName: string): string =>
  `import { buildPlugin } from "@vitnode/core/lib/plugin";

import messages from "./locales";
import { routes } from "./routes/manifest";

/**
 * This plugin, as an application registers it.
 *
 * \`pluginId\` is the package name, and that is not a convention - it is how a
 * route module is imported (\`${pluginName}/routes/home-page\`) and how this
 * plugin's messages are namespaced. The three cannot drift because they are one
 * string.
 *
 * Add this to an app's \`src/vitnode.config.ts\` \`plugins\` array. A plugin that
 * is installed but not listed there contributes nothing - no directory is ever
 * scanned - so this is the only switch.
 */
export const ${pluginVariableName(pluginName)} = () =>
  buildPlugin({
    pluginId: "${pluginName}",
    messages,
    routes,
  });
`;

/**
 * What an app may import from this plugin, and the reason a plugin route
 * `entry` is a subpath rather than a file path.
 *
 * `"./*"` maps every subpath to the build output, so `routes/manifest` is
 * imported as `<name>/routes/manifest` and resolves to
 * `dist/src/routes/manifest.js`. The plugin can move a page inside its own
 * `dist` without breaking any app that installed it, and an app resolves
 * these exactly as a published install would - there is no deep source
 * import anywhere in the path.
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
  "src/routes/home-page.tsx": pluginRouteModuleTemplate(pluginName),
  "src/routes/manifest.ts": pluginRouteManifestTemplate(pluginName),
});
