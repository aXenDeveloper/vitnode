import { describe, expect, it } from "vitest";

import {
  pluginConfigTemplate,
  pluginMessagesTemplate,
  pluginPackageExports,
  pluginRouteManifestTemplate,
  pluginRouteModuleTemplate,
  pluginRouteScaffold,
  pluginVariableName,
  routeSlugFor,
} from "./route-templates.js";

/**
 * The scaffold's pure half.
 *
 * Nothing here spawns the CLI or writes a file: what is worth pinning is that
 * the bytes a new plugin starts with are the ones VitNode's build can read, and
 * that is a string comparison. The cross-file assertions matter more than the
 * snapshots - a template that is merely *different* is a diff to approve, while
 * a manifest whose `entry` names a file the scaffold does not write is a plugin
 * that fails its first `vite build` with a resolution error.
 */
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

describe("the generated route manifest", () => {
  it("declares one route, in the canonical shape", () => {
    const manifest = pluginRouteManifestTemplate("@acme/blog");

    expect(manifest).toContain(
      'import type { PluginRouteDefinition } from "@vitnode/core/routing";',
    );
    expect(manifest).toContain("export const routes: PluginRouteDefinition[]");
    expect(manifest).toContain('entry: "routes/home-page",');
    expect(manifest).toContain('id: "home",');
    expect(manifest).toContain('path: "/blog",');
  });

  it("declares an entry with no file extension", () => {
    // An entry is a package export subpath and the export map adds the
    // extension. `routes/home-page.tsx` would resolve to
    // `dist/src/routes/home-page.tsx.js` and fail naming a file nobody wrote.
    expect(pluginRouteManifestTemplate("blog")).not.toMatch(
      /entry: "[^"]*\.[cm]?[jt]sx?"/,
    );
  });

  it("never writes a framework's path spelling", () => {
    const manifest = pluginRouteManifestTemplate("blog");
    const declared = /path: "([^"]+)"/.exec(manifest)?.[1];

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
    // whichever app installed it, so `next/*`, `next-intl` and a router are all
    // ways of making the plugin installable into exactly one kind of app.
    expect(imports).toEqual(["use-intl"]);
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

    expect(Object.keys(messages.blog.home).sort()).toEqual(["desc", "title"]);
  });
});

describe("the generated config", () => {
  it("registers the manifest's own array, not a second copy", () => {
    const config = pluginConfigTemplate("@acme/blog");

    expect(config).toContain('import { routes } from "./routes/manifest";');
    expect(config).toContain("routes,");
  });

  it("names the plugin by its package name", () => {
    expect(pluginConfigTemplate("@acme/blog")).toContain(
      'pluginId: "@acme/blog",',
    );
  });

  it("exports a factory whose name is a legal identifier", () => {
    expect(pluginConfigTemplate("@acme/my-blog")).toContain(
      "export const myBlogPlugin = () =>",
    );
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

  it("resolves a route entry to build output", () => {
    expect(resolve("routes/manifest")).toBe("./dist/src/routes/manifest.js");
    expect(resolve("routes/home-page")).toBe("./dist/src/routes/home-page.js");
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
  it("writes a file for every entry its manifest declares", () => {
    // The failure this prevents: a manifest whose `entry` names a module the
    // scaffold does not create, which fails the app's build at resolution time
    // with a message about the app rather than about the plugin.
    const files = pluginRouteScaffold("@acme/blog");
    const manifest = files["src/routes/manifest.ts"];
    const entries = [...manifest.matchAll(/entry: "([^"]+)"/g)].map(
      match => match[1],
    );

    expect(entries).not.toEqual([]);
    entries.forEach(entry => {
      expect(Object.keys(files)).toContain(`src/${entry}.tsx`);
    });
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
      expect(file.startsWith("src/")).toBe(true);
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
