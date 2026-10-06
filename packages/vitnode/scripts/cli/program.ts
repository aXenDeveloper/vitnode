import { Command, Option } from "commander";

import type { CommandContext, OutputOptions } from "./context";
import type { PublicCommandName } from "./help";
import type { Ui } from "./ui/ui";

import { describeCommand, renderRootHelp } from "./help";

/**
 * A command's handler, resolved lazily: `vitnode --help` imports none of them,
 * and `vitnode db status` never loads Vite.
 */
type Handler<O> = (context: CommandContext, options: O) => Promise<number>;

export interface ProgramHooks {
  /** Builds the context a handler runs with, from that command's own flags. */
  context: (options: OutputOptions) => CommandContext;
  /** Records what the CLI should exit with once the handler resolves. */
  setExitCode: (code: number) => void;
  /** Where commander's own output (help, usage errors) is written. */
  ui: Ui;
  version: string;
}

const outputOptions = (command: Command): Command =>
  command
    .option("--plain", "plain, line-based output without colors or animation")
    .option("--verbose", "show underlying tool output and full stack traces");

export const createProgram = (hooks: ProgramHooks): Command => {
  const run =
    <O extends OutputOptions>(
      load: () => Promise<Handler<O>>,
      fromArguments?: (values: unknown[]) => Partial<O>,
    ) =>
    async (...actionArgs: unknown[]) => {
      // Commander passes the positionals first and the command itself last.
      const command = actionArgs[actionArgs.length - 1] as Command;
      const options = {
        ...command.opts<O>(),
        ...fromArguments?.(command.processedArgs as unknown[]),
      };
      const handler = await load();

      hooks.setExitCode(await handler(hooks.context(options), options));
    };

  const program = new Command("vitnode")
    .description("Build extensible applications and communities.")
    .version(hooks.version, "-v, --version", "print the VitNode version")
    .helpOption("-h, --help", "show help")
    .helpCommand(false)
    .showSuggestionAfterError(true)
    .exitOverride()
    .configureOutput({
      // Usage errors are thrown and reported by the CLI's own boundary, in the
      // same style as every other failure - not printed here as well.
      outputError: () => undefined,
      writeErr: text => {
        hooks.ui.writeError(text.trimEnd());
      },
      writeOut: text => {
        hooks.ui.line(text.trimEnd());
      },
    })
    .configureHelp({
      styleCommandText: text => hooks.ui.colors.command(text),
      styleTitle: text => hooks.ui.colors.bold(text),
    });

  program.helpInformation = () => renderRootHelp(hooks.ui);

  const describe = (name: PublicCommandName) => describeCommand(name);

  outputOptions(program.command("dev"))
    .description(describe("dev"))
    .option("-p, --port <port>", "port for the dev server")
    .option("--host [host]", "listen on all addresses, or on the given host")
    .action(run(async () => (await import("./commands/dev")).runDevCommand));

  outputOptions(program.command("build"))
    .description(describe("build"))
    .option("--analyze", "show what contributes to the largest client bundles")
    .action(
      run(async () => (await import("./commands/build")).runBuildCommand),
    );

  outputOptions(program.command("start"))
    .description(describe("start"))
    .option("-p, --port <port>", "port for the production server")
    .option("--host <host>", "host for the production server")
    .action(
      run(async () => (await import("./commands/start")).runStartCommand),
    );

  const plugin = program
    .command("plugin")
    .description("Create, list and validate plugins");

  outputOptions(plugin.command("create"))
    .description(describe("plugin create"))
    .argument("[name]", "plugin name, e.g. blog")
    .option("--package-name <name>", "npm package name (default: derived)")
    .option("--description <text>", "one-line description")
    .option("-y, --yes", "accept the defaults instead of asking")
    .action(
      run(
        async () =>
          (await import("./commands/plugin-create")).runPluginCreateCommand,
        ([name]) => ({ name: name as string | undefined }),
      ),
    );

  outputOptions(plugin.command("list"))
    .description(describe("plugin list"))
    .action(
      run(
        async () =>
          (await import("./commands/plugin-list")).runPluginListCommand,
      ),
    );

  outputOptions(plugin.command("validate"))
    .description(describe("plugin validate"))
    .argument("[name]", "plugin id, package name or folder (default: all)")
    .action(
      run(
        async () =>
          (await import("./commands/plugin-validate")).runPluginValidateCommand,
        ([name]) => ({ name: name as string | undefined }),
      ),
    );

  const db = program
    .command("db")
    .description("Generate, apply and inspect database migrations");

  outputOptions(db.command("generate"))
    .description(describe("db generate"))
    .option("--name <name>", "migration name")
    .action(
      run(async () => (await import("./commands/db")).runDbGenerateCommand),
    );

  outputOptions(db.command("migrate"))
    .description(describe("db migrate"))
    .option("-y, --yes", "apply without asking")
    .action(
      run(async () => (await import("./commands/db")).runDbMigrateCommand),
    );

  outputOptions(db.command("push"))
    .description(describe("db push"))
    .option("-y, --yes", "apply without asking")
    .option("--accept-data-loss", "allow statements that may delete data")
    .addOption(
      new Option(
        "--force",
        "allow pushing when NODE_ENV is production",
      ).default(false),
    )
    .action(run(async () => (await import("./commands/db")).runDbPushCommand));

  outputOptions(db.command("status"))
    .description(describe("db status"))
    .action(
      run(async () => (await import("./commands/db")).runDbStatusCommand),
    );

  registerLegacyCommands(program, run);

  return program;
};

/**
 * The commands that existed before the CLI had a public surface.
 *
 * Kept working - they are in generated projects' `package.json` files and in
 * deployment guides - but left out of the root help, which lists the commands a
 * developer should reach for today.
 */
const registerLegacyCommands = (
  program: Command,
  run: <O extends OutputOptions>(
    load: () => Promise<Handler<O>>,
  ) => (...actionArgs: unknown[]) => Promise<void>,
) => {
  const legacy = async () => import("./commands/legacy");

  outputOptions(program.command("db:prepare", { hidden: true }))
    .description("Generate and apply migrations, then seed initial data")
    .action(run(async () => (await legacy()).runDbPrepareCommand));

  outputOptions(program.command("migrate", { hidden: true }))
    .description("Same as db:prepare; --generate only generates")
    .option("--generate", "only generate migrations")
    .action(run(async () => (await legacy()).runMigrateCommand));

  program
    .command("i18n:check", { hidden: true })
    .description("Find missing and unused translation keys")
    .option("--ci", "exit with an error when keys are missing")
    .action(run(async () => (await legacy()).runI18nCheckCommand));

  program
    .command("i18n:create", { hidden: true })
    .description("Add a language")
    .argument("[code]")
    .argument("[name...]")
    .action(run(async () => (await legacy()).runI18nCreateCommand));

  program
    .command("i18n:delete", { hidden: true })
    .description("Remove a language")
    .argument("[code]")
    .action(run(async () => (await legacy()).runI18nDeleteCommand));

  program
    .command("i18n:update", { hidden: true })
    .description("Sync translation files with the default language")
    .action(run(async () => (await legacy()).runI18nUpdateCommand));

  program
    .command("i18n:update:ai", { hidden: true })
    .description("Translate missing keys with AI")
    .argument("[codes...]")
    .option("--model <id>", "model id")
    .option("--concurrency <n>", "parallel requests")
    .action(run(async () => (await legacy()).runI18nUpdateAiCommand));
};
