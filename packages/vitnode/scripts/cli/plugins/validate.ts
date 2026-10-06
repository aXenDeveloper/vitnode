import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

import { compilePluginRoutes } from "../../../src/framework/plugin-routes/compile";
import {
  assertPluginId,
  pluginsFromLoadedConfig,
  routeDeclarationsFromRoutesModule,
} from "../../../src/framework/plugin-routes/resolve";
import { errorMessage } from "../errors";
import { readPackageJson } from "../project/packages";
import { toDisplayPath } from "../ui/format";

export type CheckStatus = "error" | "ok" | "skipped" | "warning";

export interface PluginCheck {
  /** Extra lines: what is wrong, where. */
  details: string[];
  name: string;
  status: CheckStatus;
  /** One line shown next to the check name. */
  summary?: string;
}

export interface PluginValidation {
  checks: PluginCheck[];
  id: string;
  root: string;
  valid: boolean;
}

export type ModuleImporter = (file: string) => Promise<unknown>;

const nativeImport: ModuleImporter = async file =>
  import(pathToFileURL(file).href) as Promise<unknown>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The plugin definition a module exports: the first exported factory that,
 * called with no arguments, returns an object with a `pluginId`.
 *
 * A plugin exports `blogPlugin = () => buildPlugin(...)` under a name of its
 * own choosing, so the name cannot be relied on - the shape can.
 */
export const findDefinition = (
  loaded: unknown,
): null | Record<string, unknown> => {
  if (!isRecord(loaded)) return null;

  for (const value of Object.values(loaded)) {
    if (typeof value !== "function") continue;
    let result: unknown;
    try {
      result = (value as () => unknown)();
    } catch {
      continue;
    }
    if (isRecord(result) && typeof result.pluginId === "string") return result;
  }

  return null;
};

/** `"@vitnode/blog.home.title"` → is that path an object or string in `messages`? */
export const hasMessagePath = (
  messages: unknown,
  namespace: string,
  pluginId: string,
): boolean => {
  // A namespace starts with the plugin id, which itself contains dots only in
  // its scope - so it is matched as one key, not split.
  const rest = namespace.startsWith(`${pluginId}.`)
    ? namespace.slice(pluginId.length + 1).split(".")
    : namespace === pluginId
      ? []
      : null;
  const head = rest === null ? namespace.split(".") : [pluginId, ...rest];

  let current: unknown = messages;
  for (const key of head) {
    if (!isRecord(current) || !(key in current)) return false;
    current = current[key];
  }

  return true;
};

const flattenKeys = (value: unknown, prefix = ""): string[] =>
  isRecord(value)
    ? Object.entries(value).flatMap(([key, child]) =>
        flattenKeys(child, prefix === "" ? key : `${prefix}.${key}`),
      )
    : [prefix];

interface NavPermission {
  module?: unknown;
  permission?: unknown;
  plugin?: unknown;
}

const navPermissions = (
  nav: unknown,
): { href: string; permission: NavPermission }[] => {
  if (!isRecord(nav) || !isRecord(nav.admin) || !Array.isArray(nav.admin.nav)) {
    return [];
  }

  return (nav.admin.nav as unknown[]).flatMap(item => {
    if (!isRecord(item)) return [];
    const children = Array.isArray(item.items) ? (item.items as unknown[]) : [];

    return [item, ...children].flatMap(entry =>
      isRecord(entry) && isRecord(entry.permission)
        ? [{ href: String(entry.href), permission: entry.permission }]
        : [],
    );
  });
};

const DRIZZLE_NAME = Symbol.for("drizzle:Name");

const tableNames = (loaded: unknown): string[] =>
  isRecord(loaded)
    ? Object.values(loaded).flatMap(value =>
        typeof value === "object" && value !== null && DRIZZLE_NAME in value
          ? [String((value as Record<symbol, unknown>)[DRIZZLE_NAME])]
          : [],
      )
    : [];

/**
 * Validates one plugin package the way an application will load it.
 *
 * Every check reads the plugin's *build output* - the same `dist` files an
 * app's Vite plugin and API import - and reuses VitNode's own validators:
 * `pluginsFromLoadedConfig` for the definition, `buildApiPlugin` (which
 * validates as it builds) for the API, and `compilePluginRoutes` for routes.
 * A check only exists where the plugin has the system it checks: a plugin
 * without `admin/nav` is not told its navigation is fine.
 */
export const validatePlugin = async (
  root: string,
  { importModule = nativeImport }: { importModule?: ModuleImporter } = {},
): Promise<PluginValidation> => {
  const checks: PluginCheck[] = [];
  const manifest = readPackageJson(root);
  const id = manifest?.name ?? toDisplayPath(root);
  const dist = (file: string) => join(root, "dist", "src", file);
  const show = (file: string) => toDisplayPath(relative(root, file));

  const fail = (name: string, details: string[], summary?: string) => {
    checks.push({ details, name, status: "error", summary });
  };
  const pass = (name: string, summary?: string) => {
    checks.push({ details: [], name, status: "ok", summary });
  };
  const done = (): PluginValidation => ({
    checks,
    id,
    root,
    valid: checks.every(check => check.status !== "error"),
  });

  // Package
  const packageProblems: string[] = [];
  if (manifest === null) {
    packageProblems.push("package.json is missing or is not valid JSON.");
  } else {
    if (manifest.name === undefined) {
      packageProblems.push('package.json has no "name" - it is the plugin id.');
    } else {
      try {
        assertPluginId(manifest.name, "package.json");
      } catch (error) {
        packageProblems.push(errorMessage(error));
      }
    }
    if (manifest.type !== "module") {
      packageProblems.push('package.json must set "type": "module".');
    }
    const exportsMap = isRecord(manifest.exports) ? manifest.exports : {};
    if (!("./*" in exportsMap) && !("./config" in exportsMap)) {
      packageProblems.push(
        'package.json "exports" must map "./*" (or at least "./config") to the build output, so apps can import the plugin.',
      );
    }
  }
  if (packageProblems.length > 0) {
    fail("Package", packageProblems);

    return done();
  }
  pass("Package", manifest?.version);

  // Build output
  const configFile = dist("config.js");
  if (!existsSync(configFile)) {
    fail("Build output", [
      `${show(configFile)} does not exist - apps load plugins from their build output.`,
      "Run vitnode build in the plugin's folder (or pnpm build:plugins), then validate again.",
    ]);

    return done();
  }

  // Plugin definition
  let definition: null | Record<string, unknown> = null;
  try {
    definition = findDefinition(await importModule(configFile));
    if (definition === null) {
      fail("Plugin definition", [
        `${show(configFile)} exports no factory returning buildPlugin({ pluginId, ... }).`,
      ]);
    } else {
      pluginsFromLoadedConfig(
        { vitNodeConfig: { plugins: [definition] } },
        show(configFile),
      );
      if (definition.pluginId !== id) {
        fail("Plugin definition", [
          `pluginId is "${String(definition.pluginId)}" but the package is "${id}". VitNode requires them to be equal - apps import the plugin by its id.`,
        ]);
      } else {
        pass("Plugin definition");
      }
    }
  } catch (error) {
    fail("Plugin definition", [errorMessage(error)]);
  }

  // API definition
  const apiFile = dist("config.api.js");
  let apiDefinition: null | Record<string, unknown> = null;
  if (existsSync(apiFile)) {
    try {
      apiDefinition = findDefinition(await importModule(apiFile));
      if (apiDefinition === null) {
        fail("API definition", [
          `${show(apiFile)} exports no factory returning buildApiPlugin({ pluginId, ... }).`,
        ]);
      } else if (apiDefinition.pluginId !== id) {
        fail("API definition", [
          `pluginId is "${String(apiDefinition.pluginId)}" but the package is "${id}".`,
        ]);
      } else {
        pass("API definition");
      }
    } catch (error) {
      fail("API definition", [errorMessage(error)]);
    }
  }

  // Routes
  const routesFile = dist("routes.js");
  let routeNamespaces: { namespace: string; path: string }[] = [];
  if (existsSync(routesFile)) {
    try {
      const routes = routeDeclarationsFromRoutesModule(
        await importModule(routesFile),
        `${id}/routes`,
      );
      const compiled = compilePluginRoutes({
        sources: [{ pluginId: id, routes, routesSpecifier: `${id}/routes` }],
      });
      const { assertComponentsImportable } =
        await import("../../../src/framework/vite/plugin-routes");
      assertComponentsImportable(compiled, new Map([[id, routesFile]]));
      const own = compiled.manifest.filter(route => route.pluginId === id);
      routeNamespaces = own.flatMap(route =>
        route.messages.map(namespace => ({ namespace, path: route.path })),
      );
      pass(
        "Routes",
        own.length === 1 ? "1 route" : `${String(own.length)} routes`,
      );
    } catch (error) {
      fail("Routes", [errorMessage(error)]);
    }
  }

  // Translations
  const localeFiles = isRecord(definition?.localeFiles)
    ? definition.localeFiles
    : null;
  if (localeFiles !== null) {
    const problems: string[] = [];
    const warnings: string[] = [];
    const resolveFromPlugin = createRequire(join(root, "package.json"));
    const loaded = new Map<string, unknown>();

    for (const [locale, specifier] of Object.entries(localeFiles)) {
      try {
        const file = resolveFromPlugin.resolve(String(specifier));
        const json: unknown = JSON.parse(readFileSync(file, "utf8"));
        if (!isRecord(json) || !(id in json)) {
          problems.push(
            `${show(file)} has no top-level "${id}" key - a plugin's strings live under its id.`,
          );
        }
        loaded.set(locale, json);
      } catch (error) {
        problems.push(
          `${locale}: ${String(specifier)} could not be read (${errorMessage(error).split("\n")[0]}).`,
        );
      }
    }

    const [defaultLocale, defaultMessages] = [...loaded.entries()][0] ?? [];
    if (defaultLocale !== undefined) {
      for (const { namespace, path } of routeNamespaces) {
        if (!hasMessagePath(defaultMessages, namespace, id)) {
          problems.push(
            `Route ${path} loads the namespace "${namespace}", which ${defaultLocale} does not define.`,
          );
        }
      }

      const expected = new Set(flattenKeys(defaultMessages));
      for (const [locale, messages] of loaded) {
        if (locale === defaultLocale) continue;
        const have = new Set(flattenKeys(messages));
        const missing = [...expected].filter(key => !have.has(key));
        if (missing.length > 0) {
          warnings.push(
            `${locale} is missing ${String(missing.length)} key(s) ${defaultLocale} has, e.g. ${missing[0]}.`,
          );
        }
      }
    }

    if (problems.length > 0) fail("Translations", [...problems, ...warnings]);
    else if (warnings.length > 0) {
      checks.push({
        details: warnings,
        name: "Translations",
        status: "warning",
      });
    } else {
      pass("Translations", [...loaded.keys()].join(", "));
    }
  }

  // Permissions referenced by the AdminCP navigation
  const navFile = dist("admin/nav.js");
  if (existsSync(navFile)) {
    try {
      const navModule = await importModule(navFile);
      const nav = isRecord(navModule) ? navModule.adminNav : undefined;
      const declared = isRecord(apiDefinition?.permissionStaff)
        ? apiDefinition.permissionStaff.admin
        : undefined;
      const problems = navPermissions(nav).flatMap(({ href, permission }) => {
        if (permission.plugin !== undefined && permission.plugin !== id)
          return [];
        const module = String(permission.module);
        const wanted = String(permission.permission);
        const entries =
          isRecord(declared) && Array.isArray(declared[module])
            ? (declared[module] as unknown[])
            : [];
        const registered = entries.some(entry =>
          typeof entry === "string"
            ? entry === wanted
            : isRecord(entry) && entry.permission === wanted,
        );

        return registered
          ? []
          : [
              `AdminCP navigation item ${href} requires the permission ${module}.${wanted},`,
              `but ${id} does not register it in buildApiPlugin({ permissionStaff: { admin } }).`,
            ];
      });

      if (problems.length > 0) {
        fail("AdminCP navigation", [...problems, show(navFile)]);
      } else pass("AdminCP navigation");
    } catch (error) {
      fail("AdminCP navigation", [errorMessage(error)]);
    }
  }

  // Database schema
  const databaseDir = dist("database");
  if (existsSync(databaseDir)) {
    const files = readdirSync(databaseDir).filter(file => file.endsWith(".js"));
    const problems: string[] = [];
    const seen = new Map<string, string>();

    for (const file of files) {
      const path = join(databaseDir, file);
      try {
        for (const table of tableNames(await importModule(path))) {
          const previous = seen.get(table);
          if (previous !== undefined && previous !== file) {
            problems.push(
              `Table "${table}" is declared in both ${previous} and ${file}.`,
            );
          }
          seen.set(table, file);
        }
      } catch (error) {
        problems.push(`${show(path)}: ${errorMessage(error).split("\n")[0]}`);
      }
    }

    if (problems.length > 0) fail("Database schema", problems);
    else
      pass(
        "Database schema",
        seen.size === 1 ? "1 table" : `${String(seen.size)} tables`,
      );
  }

  return done();
};
