import { describe, expect, it } from "vitest";

import {
  pluginApiConfigTemplate,
  pluginApiModuleTemplate,
  pluginApiRegistryFixtureTemplate,
  pluginApiRouteTemplate,
  pluginApiVariableName,
  pluginConfigTemplate,
  pluginConstTemplate,
  pluginGlobalTypesTemplate,
  pluginMessagesTemplate,
  pluginPackageExports,
  pluginRouteModuleTemplate,
  pluginRouteScaffold,
  pluginRoutesTemplate,
  pluginVariableName,
  routeSlugFor,
} from "./route-templates.js";

describe("routeSlugFor", () => {
  it("drops a scope, which a route path may not contain", () => {
    expect(routeSlugFor("@acme/blog")).toBe("blog");
  });

  it("leaves an unscoped name alone", () => {
    expect(routeSlugFor("my-vitnode-plugin")).toBe("my-vitnode-plugin");
  });

  it("keeps the characters npm and VitNode paths both allow", () => {
    expect(routeSlugFor("@acme/my_plugin.v2")).toBe("my_plugin.v2");
  });
});

describe("pluginVariableName", () => {
  it("camel-cases a kebab-case package name", () => {
    expect(pluginVariableName("my-cool-thing")).toBe("myCoolThingPlugin");
  });

  it("does not say Plugin twice", () => {
    // Which most plugins would otherwise do, since most are named for it.
    expect(pluginVariableName("my-vitnode-plugin")).toBe("myVitnodePlugin");
    expect(pluginVariableName("@acme/blog-plugin")).toBe("blogPlugin");
  });

  it("ignores the scope, which cannot appear in an identifier", () => {
    expect(pluginVariableName("@acme/my-blog")).toBe("myBlogPlugin");
  });

  it("prefixes a name that starts with a digit", () => {
    // A package name may; an identifier may not.
    expect(pluginVariableName("2fa")).toBe("vitnode2faPlugin");
  });
});

describe("pluginApiVariableName", () => {
  it("names the API factory after the UI one", () => {
    expect(pluginApiVariableName("@acme/my-blog")).toBe("myBlogApiPlugin");
  });

  it("does not say Plugin twice either", () => {
    expect(pluginApiVariableName("my-vitnode-plugin")).toBe(
      "myVitnodeApiPlugin",
    );
  });

  it("stays distinct from the UI factory, which an app imports beside it", () => {
    expect(pluginApiVariableName("@acme/blog")).not.toBe(
      pluginVariableName("@acme/blog"),
    );
  });
});

describe("the generated route tree", () => {
  it("declares one page, in the canonical shape", () => {
    const routes = pluginRoutesTemplate("@acme/blog");

    expect(routes).toContain(
      'import { definePluginRoutes, lazy, page } from "@vitnode/core/routing";',
    );
    expect(routes).toContain("export const routes = definePluginRoutes([");
    expect(routes).toContain('page("/blog", {');
    expect(routes).toContain(
      'component: lazy(() => import("./pages/home-page")),',
    );
  });

  it("never imports the page it names", () => {
    const routes = pluginRoutesTemplate("blog");
    const imports = [...routes.matchAll(/^import .*? from "([^"]+)";$/gm)].map(
      match => match[1],
    );

    expect(imports).toEqual(["@vitnode/core/routing", "./const"]);
    expect(imports).not.toContain("./pages/home-page");
    expect(routes).toContain("lazy(() => import(");
  });

  /**
   * The namespace is built by the *generated* plugin at runtime, from its own
   * `CONFIG_PLUGIN`. Written into a template literal inside a template literal,
   * so its backticks and `${}` have to survive generation rather than be
   * evaluated by it - the difference between a plugin that compiles and one
   * whose `routes.ts` says `messages: [".home"]`.
   */
  it("leaves the message namespace for the generated plugin to build", () => {
    const routes = pluginRoutesTemplate("@acme/blog");

    expect(routes).toContain("messages: [`${CONFIG_PLUGIN.pluginId}.home`],");
    expect(routes).not.toContain("@acme/blog.home");
  });

  it("declares no route id, which VitNode derives", () => {
    expect(pluginRoutesTemplate("blog")).not.toMatch(/^\s*id:/m);
  });

  it("never writes a framework's path spelling", () => {
    const routes = pluginRoutesTemplate("blog");
    const declared = /page\("([^"]+)"/.exec(routes)?.[1];

    expect(declared).toBe("/blog");
    expect(declared).not.toMatch(/[[\]$]/);
  });
});

describe("the generated route module", () => {
  it("exports a component as its default export", () => {
    expect(pluginRouteModuleTemplate("blog")).toContain(
      "export default HomePage;",
    );
  });

  it("renders through the plugin's own message namespace", () => {
    expect(pluginRouteModuleTemplate("@acme/blog")).toContain(
      'useTranslations("@acme/blog")',
    );
  });

  it("imports nothing that pins the plugin to one host", () => {
    const module = pluginRouteModuleTemplate("blog");
    const imports = [...module.matchAll(/^import .*? from "([^"]+)";$/gm)].map(
      match => match[1],
    );

    // A route module is compiled into the plugin's `dist` and imported by
    // whichever app installed it, so a router import is a way of making the
    // plugin installable into exactly one kind of app.
    expect(imports).toEqual([
      "@vitnode/core/routing",
      "@vitnode/core/routing",
      "@vitnode/core/tanstack/fetcher",
      "use-intl",
      "@/const",
    ]);
    expect(imports).not.toContain("@tanstack/react-router");
  });

  it("renders what the plugin's own endpoint answered", () => {
    const module = pluginRouteModuleTemplate("blog");

    expect(module).toContain("export const route = definePluginRoute");
    expect(module).toContain('module: "hello",');
    expect(module).toContain("{loaderData.message}");
  });

  it("declares the loader's shape, so the schema and the page check each other", () => {
    expect(pluginRouteModuleTemplate("blog")).toContain(
      "definePluginRoute<HelloMessage>",
    );
  });

  it("renders no <main>, which the application shell owns", () => {
    // Comments stripped first: the template *documents* this rule, and a scan
    // over the raw string would read the explanation as a violation of it.
    const code = pluginRouteModuleTemplate("blog").replace(
      /\/\*[\s\S]*?\*\//g,
      "",
    );

    expect(code).not.toContain("<main");
  });
});

describe("the generated messages", () => {
  it("puts every key under the plugin's own namespace", () => {
    const messages: unknown = JSON.parse(pluginMessagesTemplate("@acme/blog"));

    expect(Object.keys(messages as object)).toEqual(["@acme/blog"]);
  });

  it("provides the keys the generated page renders", () => {
    const messages = JSON.parse(pluginMessagesTemplate("blog")) as Record<
      string,
      { home: Record<string, string> }
    >;

    expect(Object.keys(messages.blog.home).sort()).toEqual([
      "api",
      "desc",
      "title",
    ]);
  });
});

describe("the generated config", () => {
  it("registers the tree's own array, not a second copy", () => {
    const config = pluginConfigTemplate("@acme/blog");

    expect(config).toContain('import { routes } from "./routes";');
    expect(config).toContain("routes,");
  });

  it("names the plugin through the one constant that holds its id", () => {
    const config = pluginConfigTemplate("@acme/blog");

    expect(config).toContain('import { CONFIG_PLUGIN } from "@/const";');
    expect(config).toContain("pluginId: CONFIG_PLUGIN.pluginId,");
    expect(config).not.toContain('"@acme/blog"');
  });

  it("exports a factory whose name is a legal identifier", () => {
    expect(pluginConfigTemplate("@acme/my-blog")).toContain(
      "export const myBlogPlugin = () =>",
    );
  });
});

describe("the generated constant", () => {
  it("holds the plugin's id as a literal, which the fetcher infers from", () => {
    const constants = pluginConstTemplate("@acme/blog");

    expect(constants).toContain('pluginId: "@acme/blog" as const,');
  });

  it("is the only generated file that spells the plugin's id out", () => {
    const files = pluginRouteScaffold("@acme/blog");

    Object.entries(files)
      .filter(
        ([file]) =>
          file !== "global.d.ts" &&
          file !== "test-fixtures/api-registry.d.ts" &&
          file !== "src/const.ts" &&
          file !== "src/locales/en.json" &&
          file !== "src/pages/home-page.tsx" &&
          file !== "src/routes.ts",
      )
      .forEach(([, contents]) => {
        expect(contents).not.toContain('"@acme/blog"');
      });
  });
});

describe("the generated API route", () => {
  it("describes its response, which is what the page's types come from", () => {
    const route = pluginApiRouteTemplate();

    expect(route).toContain('method: "get",');
    expect(route).toContain('path: "/",');
    expect(route).toContain("schema: z.object({ message: z.string() }),");
  });

  it("declares only a status that carries content", () => {
    const declared = [
      ...pluginApiRouteTemplate().matchAll(/^\s{6}(\d{3}): \{$/gm),
    ].map(match => match[1]);

    expect(declared).toEqual(["200"]);
  });
});

describe("the generated API module", () => {
  it("mounts the route under the name the page asks the fetcher for", () => {
    expect(pluginApiModuleTemplate()).toContain('name: "hello",');
    expect(pluginRouteModuleTemplate("blog")).toContain('module: "hello",');
  });

  it("registers the route's own export, not a second copy", () => {
    const module = pluginApiModuleTemplate();

    expect(module).toContain('import { helloRoute } from "./hello.route";');
    expect(module).toContain("routes: [helloRoute],");
  });
});

describe("the generated type registrations", () => {
  it("keeps the message tree registration a generated plugin always had", () => {
    const types = pluginGlobalTypesTemplate();

    expect(types).toContain('declare module "use-intl" {');
    expect(types).toContain(
      "Messages: typeof plugin & typeof core & typeof coreApi;",
    );
  });

  it("registers no API from inside the package", () => {
    // A package-level augmentation lands in the registry of every project that
    // installs the plugin, configured or not. The app's generated registry is
    // the one source of truth.
    const types = pluginGlobalTypesTemplate();

    expect(types).not.toContain("ApiPluginRegistry");
    expect(types).not.toContain("fetcher/registry");
  });

  it("registers the plugin for its own type-checking, outside the package", () => {
    const fixture = pluginApiRegistryFixtureTemplate("@acme/blog");

    expect(fixture).toContain(
      'import type { VitNodeApiPlugin } from "../src/config.api";',
    );
    expect(fixture).toContain('"@acme/blog": VitNodeApiPlugin;');
    // A `declare module` merges only into a module the program has loaded.
    expect(fixture).toContain(
      'export type { ApiPluginRegistry } from "@vitnode/core/lib/fetcher/registry";',
    );
  });

  it("evaluates nothing", () => {
    // A `.d.ts` that ran the factory would build a Hono app at type-check time.
    expect(pluginApiRegistryFixtureTemplate("blog")).not.toContain("()");
    expect(pluginGlobalTypesTemplate()).not.toContain("()");
  });
});

describe("the generated API config", () => {
  it("registers the module", () => {
    const config = pluginApiConfigTemplate("@acme/blog");

    expect(config).toContain(
      'import { helloModule } from "./api/modules/hello/hello.module";',
    );
    expect(config).toContain("modules: [helloModule],");
  });

  it("exports the reduced type an application's registry imports", () => {
    const config = pluginApiConfigTemplate("@acme/my-blog");

    expect(config).toContain(
      'import type { ApiPluginContract } from "@vitnode/core/api/lib/plugin";',
    );
    expect(config).toContain(
      "export type VitNodeApiPlugin = ApiPluginContract<",
    );
    expect(config).toContain("ReturnType<typeof myBlogApiPlugin>");
  });

  it("exports a factory an app can import beside the UI one", () => {
    expect(pluginApiConfigTemplate("@acme/my-blog")).toContain(
      "export const myBlogApiPlugin = () =>",
    );
  });

  it("stays out of the config the browser build reads", () => {
    expect(pluginConfigTemplate("@acme/blog")).not.toContain("helloModule");
  });
});

describe("the generated package exports", () => {
  /** What Node would resolve `<name>/<subpath>` to, given this export map. */
  const resolve = (subpath: string): string => {
    const map = pluginPackageExports();
    const exact = map[`./${subpath}`];

    if (typeof exact === "string") return exact;

    const wildcard = map["./*"] as { import: string };

    return wildcard.import.replace("*", subpath);
  };

  it("resolves the plugin's routes module to build output", () => {
    expect(resolve("routes")).toBe("./dist/src/routes.js");
  });

  it("resolves the plugin's locales, which the wildcard cannot", () => {
    // The `./*` pattern appends `.js`, so a `.json` subpath needs its own entry
    // or an app can import the plugin's pages and not its strings.
    expect(pluginPackageExports()["./locales/en.json"]).toBeUndefined();
    expect(pluginPackageExports()["./locales/*.json"]).toBe(
      "./src/locales/*.json",
    );
  });

  it("exposes no source path but the locales it has to", () => {
    const targets = Object.values(pluginPackageExports()).flatMap(value =>
      typeof value === "string" ? [value] : Object.values(value as object),
    );

    // An app must resolve a plugin exactly as a published install would, so
    // every subpath answers with build output - a deep source import works in a
    // monorepo and nowhere else. The one exception is the locale JSON, which is
    // copied rather than compiled and cannot go through a wildcard that appends
    // `.js`.
    expect(
      targets.filter(
        target =>
          String(target).startsWith("./src/") &&
          !String(target).endsWith(".json"),
      ),
    ).toEqual([]);
  });
});

describe("the scaffold as a whole", () => {
  it("writes a file for every module its route tree names", () => {
    // The failure this prevents: a `lazy()` naming a module the scaffold does
    // not create, which is a chunk request that 404s at the first navigation
    // rather than anything a build would notice.
    const files = pluginRouteScaffold("@acme/blog");
    const routes = files["src/routes.ts"];
    const named = [...routes.matchAll(/import\("\.\/([^"]+)"\)/g)].map(
      match => match[1],
    );

    expect(named).not.toEqual([]);
    named.forEach(module => {
      expect(Object.keys(files)).toContain(`src/${module}.tsx`);
    });
  });

  it("writes a file for every module the API config names", () => {
    const files = pluginRouteScaffold("@acme/blog");

    expect(Object.keys(files)).toContain(
      "src/api/modules/hello/hello.module.ts",
    );
    expect(Object.keys(files)).toContain(
      "src/api/modules/hello/hello.route.ts",
    );
    expect(Object.keys(files)).toContain("src/config.api.ts");
    expect(Object.keys(files)).toContain("src/const.ts");
    expect(Object.keys(files)).toContain("global.d.ts");
    expect(Object.keys(files)).toContain("test-fixtures/api-registry.d.ts");
    expect(Object.keys(files)).not.toContain("src/api/client.ts");
  });

  it("writes the messages barrel the config registers", () => {
    const files = pluginRouteScaffold("blog");

    expect(files["src/config.tsx"]).toContain(
      'import messages from "./locales";',
    );
    expect(Object.keys(files)).toContain("src/locales/index.ts");
    expect(Object.keys(files)).toContain("src/locales/en.json");
  });

  it("touches nothing outside the plugin", () => {
    // A plugin author edits no application file and no generated file: a route
    // reaches an app through its package exports, and the app's own generated
    // registry is rewritten from the plugin list on every build.
    Object.keys(pluginRouteScaffold("blog")).forEach(file => {
      expect(
        file.startsWith("src/") ||
          file.startsWith("test-fixtures/") ||
          file === "global.d.ts",
      ).toBe(true);
      expect(file).not.toContain("..");
    });
  });

  it("is a pure function of the plugin name", () => {
    expect(pluginRouteScaffold("blog")).toEqual(pluginRouteScaffold("blog"));
  });

  it("writes the same files whatever the name", () => {
    expect(Object.keys(pluginRouteScaffold("@acme/blog"))).toEqual(
      Object.keys(pluginRouteScaffold("other")),
    );
  });
});
