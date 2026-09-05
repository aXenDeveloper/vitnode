/** Every command the CLI dispatches on. */
export type CliCommandName =
  | "build"
  | "db:prepare"
  | "dev"
  | "i18n:check"
  | "i18n:create"
  | "i18n:delete"
  | "i18n:update"
  | "i18n:update:ai"
  | "migrate";

export interface CliCommandArguments {
  flags: readonly string[];

  positional: "any" | number;
  /** One line of usage, printed with every refusal. */
  usage: string;

  valueFlags?: readonly string[];
}

export const COMMAND_ARGUMENTS: Record<CliCommandName, CliCommandArguments> = {
  build: { flags: [], positional: 0, usage: "vitnode build" },
  "db:prepare": { flags: [], positional: 0, usage: "vitnode db:prepare" },
  dev: { flags: [], positional: 0, usage: "vitnode dev" },
  "i18n:check": {
    flags: ["--ci"],
    positional: 0,
    usage: "vitnode i18n:check [--ci]",
  },
  "i18n:create": {
    flags: [],
    positional: "any",
    usage: 'vitnode i18n:create <code> "<name>"',
  },
  "i18n:delete": {
    flags: [],
    positional: 1,
    usage: "vitnode i18n:delete <code>",
  },
  "i18n:update": { flags: [], positional: 0, usage: "vitnode i18n:update" },
  "i18n:update:ai": {
    flags: ["--concurrency", "--model"],
    positional: "any",
    usage:
      "vitnode i18n:update:ai [code...] [--model <id>] [--concurrency <n>]",
    valueFlags: ["--concurrency", "--model"],
  },
  migrate: {
    flags: ["--generate"],
    positional: 0,
    usage: "vitnode migrate [--generate]",
  },
};

/** The command names, sorted, for the message an unknown one prints. */
export const cliCommandNames = (): CliCommandName[] =>
  (Object.keys(COMMAND_ARGUMENTS) as CliCommandName[]).sort();

/** Whether `vitnode <name>` is a command at all. */
export const isCliCommandName = (
  name: string | undefined,
): name is CliCommandName =>
  name !== undefined && Object.hasOwn(COMMAND_ARGUMENTS, name);

export type ParsedCli =
  | { args: readonly string[]; command: CliCommandName; ok: true }
  | { message: string; ok: false };

const quoted = (values: readonly string[]): string =>
  values.map(value => `"${value}"`).join(", ");

/** `--model=gpt-5` as `["--model", "gpt-5"]`; a plain flag as `[flag]`. */
const splitFlag = (arg: string): [string, string | undefined] => {
  const equals = arg.indexOf("=");

  return equals === -1
    ? [arg, undefined]
    : [arg.slice(0, equals), arg.slice(equals + 1)];
};

const allowedSentence = (spec: CliCommandArguments): string =>
  spec.flags.length === 0
    ? "It accepts no flags."
    : `Allowed: ${[...spec.flags].sort().join(", ")}.`;

/**
 * The first thing wrong with `args`, or `null`.
 *
 * First rather than all of them, because the list is short and the first
 * problem is the one that explains the rest: `migrate --generat --generat` is
 * one typo, not two findings.
 *
 * A token is treated as a flag when it starts with `-`, so `vitnode build -x`
 * is refused as an unknown flag rather than counted as a positional. No command
 * here has a negative-number argument for that to get in the way of.
 */
const firstProblem = (
  command: CliCommandName,
  spec: CliCommandArguments,
  args: readonly string[],
): null | string => {
  const where = `for command "${command}"`;
  const usage = `Usage: ${spec.usage}`;

  // The six commands that read nothing at all. Said as one sentence, because
  // "allowed flags: none, allowed positionals: none" is the same fact twice.
  if (spec.flags.length === 0 && spec.positional === 0) {
    return args.length === 0
      ? null
      : `Command "${command}" accepts no arguments, but got ${quoted(args)}. ${usage}`;
  }

  const valueFlags = spec.valueFlags ?? [];
  const seen = new Set<string>();
  let positional = 0;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg.startsWith("-")) {
      positional += 1;
      continue;
    }

    const [flag, inlineValue] = splitFlag(arg);

    if (!spec.flags.includes(flag)) {
      return `Invalid argument "${arg}" ${where}. ${allowedSentence(spec)} ${usage}`;
    }

    // Repetition rather than "at most one flag": every flag here is a switch or
    // a single setting, so a second `--generate` is as meaningless as a second
    // `--model`, and saying so names the flag instead of counting tokens.
    if (seen.has(flag)) {
      return `Argument "${flag}" is repeated ${where}. ${usage}`;
    }
    seen.add(flag);

    if (!valueFlags.includes(flag)) {
      if (inlineValue !== undefined) {
        return `Argument "${flag}" ${where} takes no value. ${usage}`;
      }
      continue;
    }

    if (inlineValue !== undefined) {
      if (inlineValue === "") {
        return `Argument "${flag}" ${where} needs a value. ${usage}`;
      }

      // `--model=gpt-5` carries its own value, so nothing is consumed and the
      // scan continues - returning here would leave every later token unchecked.
      continue;
    }

    const next = args[index + 1];

    if (next === undefined || next.startsWith("-")) {
      return `Argument "${flag}" ${where} needs a value. ${usage}`;
    }

    // Consumed as the flag's value, so it is not one of the positionals below.
    index += 1;
  }

  if (spec.positional !== "any" && positional > spec.positional) {
    return spec.positional === 0
      ? `Command "${command}" accepts no positional arguments, but got ${String(positional)}. ${usage}`
      : `Command "${command}" accepts at most ${String(spec.positional)} argument, but got ${String(positional)}. ${usage}`;
  }

  return null;
};

/**
 * `process.argv.slice(2)`, checked.
 *
 * Pure: it returns a refusal rather than printing or exiting, so every case
 * below can be stated as an assertion instead of a spawned process.
 *
 * `--help` and `--version` are not commands and are refused as such. They have
 * never been part of this CLI's contract, and inventing them here would be a
 * feature rather than the validation this is.
 */
export const parseCliArguments = (argv: readonly string[]): ParsedCli => {
  const [name, ...args] = argv;
  const available = `Available commands: ${cliCommandNames().join(", ")}.`;

  if (name === undefined || name === "") {
    return { message: `No command given. ${available}`, ok: false };
  }

  if (!isCliCommandName(name)) {
    return { message: `Command not found: "${name}". ${available}`, ok: false };
  }

  const problem = firstProblem(name, COMMAND_ARGUMENTS[name], args);

  return problem === null
    ? { args, command: name, ok: true }
    : { message: problem, ok: false };
};
