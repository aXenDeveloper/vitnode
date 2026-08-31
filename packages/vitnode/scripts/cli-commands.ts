/**
 * The commands `vitnode` answers to, as data.
 *
 * Separated from the dispatch in `scripts.ts` so the surface can be read - by
 * `--help`, and by a test - without running anything. A command that is not on
 * this list does not exist: `scripts.ts` looks the name up here before it does
 * any work, so the help text and the dispatch cannot describe different CLIs.
 */

/** The group a command is listed under in `--help`. */
export type CliCommandGroup = "Database" | "Plugin package" | "Translations";

export interface CliCommand {
  /** The flag a command accepts, if it has one, as it appears in `--help`. */
  flag?: string;
  group: CliCommandGroup;
  name: string;
  /** One line, printed beside the name. */
  summary: string;
}

/**
 * Every command, in the order `--help` prints them.
 *
 * The two database entries are one implementation with two names, and the
 * summaries are where that is said: `db:prepare` is the bootstrap a `dev` script
 * waits for, `migrate` is the same work under the name deployments and the
 * documentation use, and `--generate` is the one thing only `migrate` does.
 * See `prepare-database.ts`.
 */
export const CLI_COMMANDS: CliCommand[] = [
  {
    group: "Database",
    name: "db:prepare",
    summary:
      "Development bootstrap - generate, apply, seed. Idempotent, and what a `dev` script gates on.",
  },
  {
    group: "Database",
    name: "migrate",
    summary: "The same bootstrap, under the name deployments and the docs use.",
  },
  {
    flag: "--generate",
    group: "Database",
    name: "migrate",
    summary: "Write migration files for the current schema, and stop.",
  },
  {
    group: "Plugin package",
    name: "build",
    summary: "Compile the plugin in the working directory once.",
  },
  {
    group: "Plugin package",
    name: "dev",
    summary: "The same compilers, in watch mode.",
  },
  {
    flag: "[--ci]",
    group: "Translations",
    name: "i18n:check",
    summary: "Report locale files that have drifted from the default language.",
  },
  {
    group: "Translations",
    name: "i18n:create",
    summary: "Add a locale to this app and to every installed package.",
  },
  {
    group: "Translations",
    name: "i18n:delete",
    summary: "Remove a locale from this app and from every installed package.",
  },
  {
    group: "Translations",
    name: "i18n:update",
    summary: "Copy new keys from the default language into every locale.",
  },
  {
    group: "Translations",
    name: "i18n:update:ai",
    summary: "The same, translating the new keys with the configured AI model.",
  },
];

/** The command names the CLI dispatches on, without duplicates. */
export const cliCommandNames = (): string[] => [
  ...new Set(CLI_COMMANDS.map(command => command.name)),
];

/** Whether `vitnode <name>` is a command at all. */
export const isCliCommand = (name: string | undefined): boolean =>
  name !== undefined && cliCommandNames().includes(name);

/** The argument spellings that ask for the command list rather than a command. */
export const HELP_FLAGS = ["--help", "-h", "help"];

/** `vitnode --help`. */
export const renderHelp = (): string => {
  const spelling = (command: CliCommand) =>
    command.flag === undefined
      ? command.name
      : `${command.name} ${command.flag}`;
  const width = Math.max(
    ...CLI_COMMANDS.map(command => spelling(command).length),
  );

  const groups = [...new Set(CLI_COMMANDS.map(command => command.group))].map(
    group =>
      [
        `${group}:`,
        ...CLI_COMMANDS.filter(command => command.group === group).map(
          command => `  ${spelling(command).padEnd(width)}  ${command.summary}`,
        ),
      ].join("\n"),
  );

  return `Usage: vitnode <command>\n\n${groups.join("\n\n")}\n`;
};
