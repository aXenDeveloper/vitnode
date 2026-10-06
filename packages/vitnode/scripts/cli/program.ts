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
    .description("List and validate plugins")
    .addHelpText(
      "after",
      "\nCreate a plugin with: npx create-vitnode-app --plugin <name>",
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

  registerI18nCommands(program, run);
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
type Run = <O extends OutputOptions>(
  load: () => Promise<Handler<O>>,
  fromArguments?: (values: unknown[]) => Partial<O>,
) => (...actionArgs: unknown[]) => Promise<void>;

/**
 * `vitnode i18n <command>`, plus each command under its older `i18n:<command>`
 * name - hidden, but parsed by the same definition, so the two spellings
 * cannot accept different flags.
 */
const registerI18nCommands = (program: Command, run: Run) => {
  const handlers = async () => import("./commands/i18n");
  const i18n = program
    .command("i18n")
    .description(describeCommand("i18n <command>"));

  const define = (
    name: string,
    legacyName: string,
    build: (command: Command) => Command,
  ) => {
    build(outputOptions(i18n.command(name)));
    build(outputOptions(program.command(legacyName, { hidden: true })));
  };

  define("check", "i18n:check", command =>
    command
      .description("Find missing, unknown and unloaded translations")
      .option("--ci", "also fail on missing keys")
      .action(run(async () => (await handlers()).runI18nCheckCommand)),
  );

  define("create", "i18n:create", command =>
    command
      .description("Add a language")
      .argument("[code]", "locale code, e.g. pl or pt-BR")
      .argument("[name...]", "language name, e.g. Polski")
      .action(
        run(
          async () => (await handlers()).runI18nCreateCommand,
          ([code, name]) => ({
            code: code as string | undefined,
            name: name as string[] | undefined,
          }),
        ),
      ),
  );

  define("delete", "i18n:delete", command =>
    command
      .description("Remove a language")
      .argument("[code]", "locale code to remove")
      .option("-y, --yes", "remove without asking")
      .action(
        run(
          async () => (await handlers()).runI18nDeleteCommand,
          ([code]) => ({ code: code as string | undefined }),
        ),
      ),
  );

  define("update", "i18n:update", command =>
    command
      .description("Sync translation files with the default language")
      .action(run(async () => (await handlers()).runI18nUpdateCommand)),
  );

  define("update-ai", "i18n:update:ai", command =>
    command
      .description("Translate missing strings with an AI model")
      .argument("[codes...]", "locale codes (default: ask, or every language)")
      .option("--model <id>", "AI model id from vitnode.api.config.ts")
      .option("--concurrency <n>", "model calls in parallel")
      .action(
        run(
          async () => (await handlers()).runI18nUpdateAiCommand,
          ([codes]) => ({ codes: codes as string[] | undefined }),
        ),
      ),
  );
};

const registerLegacyCommands = (program: Command, run: Run) => {
  const legacy = async () => import("./commands/legacy");

  outputOptions(program.command("db:prepare", { hidden: true }))
    .description("Generate and apply migrations, then seed initial data")
    .action(run(async () => (await legacy()).runDbPrepareCommand));

  outputOptions(program.command("migrate", { hidden: true }))
    .description("Same as db:prepare; --generate only generates")
    .option("--generate", "only generate migrations")
    .action(run(async () => (await legacy()).runMigrateCommand));
};
