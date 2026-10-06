import { relative } from "node:path";

import type { CommandContext, OutputOptions } from "../context";
import type { TemplateGroup } from "../plugins/template";

import { EXIT_CODE, UserError } from "../errors";
import {
  planPlugin,
  pluginDependencyVersions,
  resolvePluginWorkspace,
  writeTemplateFiles,
} from "../plugins/create";
import { isPluginPackage } from "../plugins/discover";
import {
  defaultPackageName,
  pluginApiVariableName,
  pluginVariableName,
  validatePackageName,
  validatePluginName,
} from "../plugins/naming";
import { pluginTemplate } from "../plugins/template";
import { toDisplayPath } from "../ui/format";
import { readCoreManifest } from "../version";

export interface PluginCreateOptions extends OutputOptions {
  description?: string;
  name?: string;
  packageName?: string;
  yes?: boolean;
}

const STEPS: { group: TemplateGroup; label: string }[] = [
  { group: "package", label: "Package created" },
  { group: "definition", label: "Plugin definition" },
  { group: "structure", label: "Required structure" },
  { group: "translations", label: "Translations" },
  { group: "tests", label: "Tests" },
  { group: "documentation", label: "Documentation" },
];

const asPrompt =
  (validate: (value: string) => null | string) => (value: string) =>
    validate(value.trim()) ?? true;

export const runPluginCreateCommand = async (
  { cwd, prompter, ui }: CommandContext,
  options: PluginCreateOptions,
): Promise<number> => {
  ui.header("Create plugin");

  const workspace = resolvePluginWorkspace(cwd);
  const ask = ui.interactive && options.yes !== true;

  const name =
    options.name ??
    (ui.interactive
      ? (
          await prompter.text("Plugin name", {
            validate: asPrompt(validatePluginName),
          })
        ).trim()
      : undefined);

  if (name === undefined) {
    throw new UserError("A plugin name is required.", {
      hint: "Pass it as an argument: vitnode plugin create <name>",
    });
  }

  // Fail on a bad name before asking anything else about it.
  const nameProblem = validatePluginName(name);
  if (nameProblem !== null) throw new UserError(nameProblem);
  if (options.name !== undefined && ui.interactive)
    ui.success(`Plugin name  ${name}`);

  const existingIds = [...workspace.packages.entries()]
    .filter(([, dir]) => isPluginPackage(dir))
    .map(([id]) => id);
  const suggestedPackage = defaultPackageName(name, existingIds);

  const packageName =
    options.packageName ??
    (ask
      ? (
          await prompter.text("Package name", {
            default: suggestedPackage,
            validate: asPrompt(validatePackageName),
          })
        ).trim()
      : suggestedPackage);

  const description =
    options.description ??
    (ask
      ? (
          await prompter.text("Description", {
            default: `A VitNode plugin.`,
          })
        ).trim()
      : "A VitNode plugin.");

  const plan = planPlugin({ description, name, packageName, workspace });
  const files = pluginTemplate({
    description,
    name,
    packageName,
    versions: pluginDependencyVersions(readCoreManifest(), workspace),
  });

  ui.line();
  ui.line(
    ui.mode === "plain"
      ? "Creating plugin..."
      : `  ${ui.colors.muted("Creating plugin...")}`,
  );
  for (const step of STEPS) {
    writeTemplateFiles(
      plan.targetDir,
      files.filter(file => file.group === step.group),
    );
    ui.success(step.label);
  }

  const shown = toDisplayPath(relative(cwd, plan.targetDir)) || ".";
  ui.section("Created");
  ui.line(`  ${ui.colors.command(shown)}`);

  ui.section("Next steps");
  const steps = [
    ...(workspace.pluginsDirIsLinked
      ? []
      : [
          `Add "${toDisplayPath(relative(workspace.root, workspace.pluginsDir))}/*" to your workspace packages`,
        ]),
    `Add "${packageName}": "workspace:*" to your app's dependencies, then install`,
    `Register ${pluginVariableName(name)}() from "${packageName}/config" in vitnode.config.ts`,
    `Register ${pluginApiVariableName(name)}() from "${packageName}/config.api" in vitnode.api.config.ts`,
    `Build it: ${ui.colors.command(`cd ${shown} && vitnode build`)}`,
    `Check it: ${ui.colors.command(`vitnode plugin validate ${name}`)}`,
  ];
  steps.forEach((step, index) => {
    ui.line(`  ${ui.colors.muted(`${String(index + 1)}.`)} ${step}`);
  });
  ui.line();

  return EXIT_CODE.ok;
};
