import { basename, relative } from "node:path";

import type { CommandContext, OutputOptions } from "../context";
import type {
  DiscoveredPlugin,
  LoadConfiguredPluginIds,
} from "../plugins/discover";
import type { ModuleImporter, PluginCheck } from "../plugins/validate";
import type { Ui } from "../ui/ui";

import { EXIT_CODE, UserError, ValidationError } from "../errors";
import { discoverPlugins, isPluginPackage } from "../plugins/discover";
import { validatePlugin } from "../plugins/validate";
import { findPackageRoot, readPackageJson } from "../project/packages";
import { plural, toDisplayPath } from "../ui/format";

export interface PluginValidateOptions extends OutputOptions {
  name?: string;
}

/** `@acme/blog` → `blog`; `blog` → `blog`. */
const shortNameOf = (packageName: string): string =>
  packageName.includes("/")
    ? packageName.slice(packageName.indexOf("/") + 1)
    : packageName;

/** `blog`, `@vitnode/blog` and `plugins/blog` all name the same plugin. */
export const matchesPlugin = (plugin: DiscoveredPlugin, query: string) =>
  plugin.id === query ||
  shortNameOf(plugin.id) === query ||
  (plugin.root !== null && basename(plugin.root) === query);

const renderCheck = (ui: Ui, check: PluginCheck) => {
  const summary = check.summary ?? "";

  switch (check.status) {
    case "error":
      if (ui.mode === "plain") ui.line(`[FAIL] ${check.name}`);
      else ui.line(`  ${ui.colors.error(ui.symbols.error)} ${check.name}`);
      break;
    case "ok":
      ui.success(check.name, summary === "" ? undefined : summary);
      break;
    case "skipped":
      ui.note(`${check.name} (skipped)`);
      break;
    case "warning":
      ui.warning(check.name);
      break;
  }

  check.details.forEach(detail => {
    ui.line(ui.mode === "plain" ? `  ${detail}` : `      ${detail}`);
  });
};

export const runPluginValidateCommand = async (
  { cwd, ui }: CommandContext,
  { name }: PluginValidateOptions,
  deps: {
    importModule?: ModuleImporter;
    loadIds?: LoadConfiguredPluginIds;
  } = {},
): Promise<number> => {
  ui.header("Validate plugins");

  const packageRoot = findPackageRoot(cwd);
  const insidePlugin =
    name === undefined && packageRoot !== null && isPluginPackage(packageRoot);

  let targets: { id: string; root: null | string }[];

  if (insidePlugin) {
    targets = [
      {
        id: readPackageJson(packageRoot)?.name ?? packageRoot,
        root: packageRoot,
      },
    ];
  } else {
    const { plugins } = await discoverPlugins(cwd, { loadIds: deps.loadIds });
    const selected =
      name === undefined
        ? plugins
        : plugins.filter(plugin => matchesPlugin(plugin, name));

    if (name !== undefined && selected.length === 0) {
      throw new UserError(`No plugin named "${name}" was found.`, {
        hint:
          plugins.length === 0
            ? "Create one with vitnode plugin create <name>."
            : `Known plugins: ${plugins.map(plugin => plugin.id).join(", ")}`,
      });
    }

    targets = selected.map(plugin => ({ id: plugin.id, root: plugin.root }));
  }

  if (targets.length === 0) {
    ui.note("No plugins to validate.");
    ui.line();

    return EXIT_CODE.ok;
  }

  const invalid: string[] = [];

  for (const [index, target] of targets.entries()) {
    // The header already ends with a blank line.
    if (index > 0) ui.line();
    const where =
      target.root === null
        ? ""
        : toDisplayPath(relative(cwd, target.root)) || ".";
    ui.line(
      ui.mode === "plain"
        ? `${target.id}${where ? ` (${where})` : ""}`
        : `  ${ui.colors.bold(target.id)}  ${ui.colors.muted(where)}`,
    );

    if (target.root === null) {
      renderCheck(ui, {
        details: [
          `${target.id} is configured but not installed - run your package manager's install.`,
        ],
        name: "Package",
        status: "error",
      });
      invalid.push(target.id);
      continue;
    }

    const result = await validatePlugin(target.root, {
      importModule: deps.importModule,
    });
    result.checks.forEach(check => {
      renderCheck(ui, check);
    });
    if (!result.valid) invalid.push(target.id);
  }

  ui.line();

  if (invalid.length > 0) {
    throw new ValidationError(
      `${plural(invalid.length, "plugin")} failed validation: ${invalid.join(", ")}`,
    );
  }

  ui.success(`${plural(targets.length, "plugin")} valid`);
  ui.line();

  return EXIT_CODE.ok;
};
