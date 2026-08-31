/**
 * What `vitnode <command>` accepts, and the pure check that enforces it.
 *
 * Separated from `scripts.ts` so the contract can be read and tested without
 * running anything: no `dotenv`, no database, no compiler, no `process.exit`.
 * The entry point calls {@link parseCliArguments} and exits on a refusal
 * **before** it dispatches, which is the whole point - a typo has to fail rather
 * than change what a command does.
 *
 * ## The failure this exists to stop
 *
 * The entry point read `process.argv[2]` as the command and `process.argv[3]` as
 * "the flag", compared that one string to `"--generate"`, and ignored everything
 * else. So `vitnode migrate --generat` did not fail: the comparison was false,
 * and the command fell through to the *full* bootstrap - generate, apply, seed -
 * against whatever `POSTGRES_URL` names. A mistyped flag silently became a
 * different command. `vitnode i18n:check --cii` was the same shape with a
 * quieter cost: `isCi` was false, so a CI job asking for a hard failure got a
 * soft report and a zero exit.
 *
 * Both are now refusals, and neither reaches an implementation.
 */

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
  /**
   * The flags this command accepts, exactly as they have to be spelled.
   *
   * Per command, never global: `--ci` is `i18n:check`'s and means nothing to
   * `migrate`, and a whitelist shared across commands would make
   * `vitnode migrate --ci` a legal way to ask for nothing.
   */
  flags: readonly string[];
  /**
   * How many bare (non-flag) arguments the implementation actually reads.
   *
   * Read off the implementation rather than chosen: a command that reads
   * `process.argv[3]` and nothing else takes one, and `"any"` is for the ones
   * that join everything they are handed.
   */
  positional: "any" | number;
  /** One line of usage, printed with every refusal. */
  usage: string;
  /**
   * The flags above that consume the following token as their value.
   *
   * `--model gpt-5` and `--model=gpt-5` are both spellings the implementation
   * already accepts, so both are accepted here - and a value-taking flag with no
   * value is a refusal rather than an `undefined` handed downstream.
   */
  valueFlags?: readonly string[];
}

/**
 * The contract, per command, as data.
 *
 * Every entry was read off the implementation it describes, which is why three
 * of them take arguments that a glance at `scripts.ts` would not suggest:
 *
 * - `i18n:create` reads `process.argv.slice(3)` as `[code, ...nameParts]` and
 *   joins the tail into the language name, so anything supplied skips its prompt
 *   and the command works on a non-interactive stdin. Unbounded on purpose - a
 *   name is several words.
 * - `i18n:delete` reads `process.argv[3]` and only that, so it takes exactly one.
 * - `i18n:update:ai` parses its own `--model` / `--concurrency` and treats every
 *   remaining token as a locale code.
 *
 * Those three keep parsing their own `argv`; what changes is that they are no
 * longer reached with an `argv` this table rejects. The other six take nothing,
 * and said so only by ignoring what they were given.
 */
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

/**
 * A validated invocation, or the reason it was refused.
 *
 * `args` is the argument list unchanged, and every token in it has been checked
 * against the command's own table - so `args.includes("--generate")` in the
 * entry point cannot be satisfied by anything but that exact spelling, and the
 * three commands that read their own `argv` are only ever started on an `argv`
 * this function accepted.
 */
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
