import { relative } from "node:path";

import type { CommandContext, OutputOptions } from "../context";
import type { LoadConfiguredPluginIds } from "../plugins/discover";

import { EXIT_CODE } from "../errors";
import { discoverPlugins } from "../plugins/discover";
import { plural, toDisplayPath } from "../ui/format";

export const runPluginListCommand = async (
  { cwd, ui }: CommandContext,
  _options: OutputOptions,
  { loadIds }: { loadIds?: LoadConfiguredPluginIds } = {},
): Promise<number> => {
  ui.header("Plugins");

  const { appRoot, plugins } = await discoverPlugins(cwd, { loadIds });

  if (plugins.length === 0) {
    ui.note(
      appRoot === null
        ? "No VitNode app or workspace plugins found here."
        : "No plugins configured yet.",
    );
    ui.note(
      `Create one with ${ui.colors.command("vitnode plugin create <name>")}.`,
    );
    ui.line();

    return EXIT_CODE.ok;
  }

  ui.table({
    columns: [
      { header: "Plugin" },
      { header: "Version" },
      { header: "Source" },
      ...(ui.verbose ? [{ header: "Path" }, { header: "Description" }] : []),
    ],
    rows: plugins.map(plugin => [
      plugin.configured
        ? plugin.id
        : `${plugin.id} ${ui.colors.muted("(not configured)")}`,
      plugin.version ?? ui.colors.warning("not installed"),
      ui.colors.muted(plugin.source),
      ...(ui.verbose
        ? [
            ui.colors.muted(
              plugin.root === null
                ? "-"
                : toDisplayPath(relative(cwd, plugin.root)) || ".",
            ),
            plugin.description ?? "",
          ]
        : []),
    ]),
  });

  const configured = plugins.filter(plugin => plugin.configured).length;
  ui.line();
  ui.note(
    appRoot === null
      ? `${plural(plugins.length, "plugin")} in this workspace`
      : `${plural(configured, "plugin")} configured in ${toDisplayPath(relative(cwd, appRoot)) || "this app"}`,
  );
  ui.line();

  return EXIT_CODE.ok;
};
