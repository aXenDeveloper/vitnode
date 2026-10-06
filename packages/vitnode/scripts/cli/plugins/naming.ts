import { builtinModules } from "node:module";

import { CORE_PLUGIN_ID } from "../../../src/framework/plugin-routes/core";

/**
 * Folder names a plugin cannot take, because its example page is served at
 * `/<name>` and these are core's own top-level routes (or areas). A plugin
 * named `admin` would fail its first build with a route collision; refusing it
 * here says so before any file is written.
 */
export const RESERVED_PLUGIN_NAMES: ReadonlySet<string> = new Set([
  "admin",
  "api",
  "core",
  "discover",
  "files",
  "login",
  "notifications",
  "register",
  "search",
  "users",
  "vitnode",
]);

const NAME_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/**
 * Why `name` cannot be a plugin's short name, or `null`.
 *
 * The short name is the folder under `plugins/`, the example route and the
 * base of the package name, so it is held to the strictest of the three:
 * lowercase kebab-case starting with a letter.
 */
export const validatePluginName = (name: string): null | string => {
  if (name === "") return "A plugin name is required.";
  if (name.length > 50) return "Keep the plugin name under 50 characters.";
  if (!NAME_PATTERN.test(name)) {
    return `"${name}" is not a valid plugin name. Use lowercase letters, digits and single dashes, starting with a letter - e.g. "blog" or "event-calendar".`;
  }
  if (RESERVED_PLUGIN_NAMES.has(name)) {
    return `"${name}" is reserved by VitNode - core already serves /${name}.`;
  }

  return null;
};

const PACKAGE_PATTERN =
  /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

/**
 * Why `name` cannot be the plugin's npm package name, or `null`.
 *
 * npm's own rules for new packages, plus VitNode's: the package name *is* the
 * plugin id, and `@vitnode/core` belongs to core.
 */
export const validatePackageName = (name: string): null | string => {
  if (name === "") return "A package name is required.";
  if (name.length > 214)
    return "npm package names are limited to 214 characters.";
  if (name !== name.toLowerCase())
    return "npm package names must be lowercase.";
  if (!PACKAGE_PATTERN.test(name)) {
    return `"${name}" is not a valid npm package name.`;
  }
  if (name === CORE_PLUGIN_ID)
    return `"${CORE_PLUGIN_ID}" is VitNode's core package.`;
  if (!name.startsWith("@") && builtinModules.includes(name)) {
    return `"${name}" is a Node.js built-in module.`;
  }

  return null;
};

/** `@acme/my-blog` → `my-blog`; `blog` → `blog`. */
export const shortNameOf = (packageName: string): string =>
  packageName.includes("/")
    ? packageName.slice(packageName.indexOf("/") + 1)
    : packageName;

/**
 * The package name a new plugin gets unless the developer types another.
 *
 * Follows the workspace: if its plugins share a scope (`@vitnode/blog`,
 * `@vitnode/example`), the new one joins it. Otherwise it is unscoped and
 * prefixed, the npm convention for an ecosystem's plugins.
 */
export const defaultPackageName = (
  name: string,
  existingPluginIds: readonly string[],
): string => {
  const scopes = new Set(
    existingPluginIds
      .filter(id => id.startsWith("@") && id.includes("/"))
      .map(id => id.slice(0, id.indexOf("/"))),
  );

  return scopes.size === 1
    ? `${[...scopes][0]}/${name}`
    : `vitnode-plugin-${name}`;
};

/** `my-blog` → `myBlogPlugin`; a leading digit gets a `vitnode` prefix. */
export const pluginVariableName = (name: string): string => {
  const camel = name
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part, index) =>
      index === 0 ? part : `${part[0].toUpperCase()}${part.slice(1)}`,
    )
    .join("");
  const safe = /^[A-Za-z]/.test(camel) ? camel : `vitnode${camel}`;
  const stem = safe.replace(/plugin$/i, "");

  return `${stem === "" ? safe : stem}Plugin`;
};

export const pluginApiVariableName = (name: string): string =>
  pluginVariableName(name).replace(/Plugin$/, "ApiPlugin");

/** `event-calendar` → `Event calendar`. */
export const titleOf = (name: string): string => {
  const words = name.replaceAll("-", " ");

  return `${words[0]?.toUpperCase() ?? ""}${words.slice(1)}`;
};
