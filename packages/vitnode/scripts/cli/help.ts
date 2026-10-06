import type { Ui } from "./ui/ui";

import { padEnd } from "./ui/colors";

/**
 * The public commands, in the order root help lists them.
 *
 * One list for both the parser's descriptions and the help screen, so the two
 * cannot describe different CLIs.
 */
export const PUBLIC_COMMANDS = [
  { description: "Start the development environment", name: "dev" },
  { description: "Build for production", name: "build" },
  { description: "Start the production server", name: "start" },
  { description: "Create a plugin", name: "plugin create" },
  { description: "List plugins", name: "plugin list" },
  { description: "Validate plugins", name: "plugin validate" },
  { description: "Generate a migration", name: "db generate" },
  { description: "Run pending migrations", name: "db migrate" },
  { description: "Push schema changes (development)", name: "db push" },
  { description: "Show migration status", name: "db status" },
] as const;

export type PublicCommandName = (typeof PUBLIC_COMMANDS)[number]["name"];

export const describeCommand = (name: PublicCommandName): string =>
  PUBLIC_COMMANDS.find(command => command.name === name)?.description ?? "";

const EXAMPLES = [
  "vitnode dev",
  "vitnode plugin create blog",
  "vitnode build --analyze",
];

/** `vitnode` and `vitnode --help`: short on purpose - the docs hold the rest. */
export const renderRootHelp = (ui: Ui): string => {
  const { colors, symbols } = ui;
  const width = Math.max(...PUBLIC_COMMANDS.map(({ name }) => name.length)) + 4;
  const title = (text: string) => colors.bold(text);

  return [
    "",
    `  ${colors.primary(`${symbols.brand} VitNode`)}`,
    `  ${colors.muted("Build extensible applications and communities.")}`,
    "",
    title("Usage"),
    `  ${colors.command("vitnode <command> [options]")}`,
    "",
    title("Commands"),
    ...PUBLIC_COMMANDS.map(
      ({ description, name }) =>
        `  ${padEnd(colors.command(name), width)}${description}`,
    ),
    "",
    title("Examples"),
    ...EXAMPLES.map(example => `  ${colors.command(example)}`),
    "",
    colors.muted(
      `Run ${colors.command("vitnode <command> --help")} for a command's options.`,
    ),
    "",
  ].join("\n");
};
