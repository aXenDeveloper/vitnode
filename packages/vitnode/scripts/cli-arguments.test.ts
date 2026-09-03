// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { CliCommandName } from "./cli-arguments.js";

import {
  cliCommandNames,
  COMMAND_ARGUMENTS,
  parseCliArguments,
} from "./cli-arguments.js";

const scriptsRoot = import.meta.dirname;

const codeOf = (file: string): string =>
  readFileSync(join(scriptsRoot, file), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

/** The refusal message, or `null` when the invocation was accepted. */
const refusal = (...argv: string[]): null | string => {
  const parsed = parseCliArguments(argv);

  return parsed.ok ? null : parsed.message;
};

/** The accepted parse, or `null` when it was refused. */
const accepted = (
  ...argv: string[]
): null | { args: readonly string[]; command: CliCommandName } => {
  const parsed = parseCliArguments(argv);

  return parsed.ok ? { args: parsed.args, command: parsed.command } : null;
};

describe("the contract covers every command the CLI dispatches", () => {
  const entryPoint = codeOf("scripts.ts");
  const dispatched = [...entryPoint.matchAll(/case "([^"]+)":/g)]
    .map(match => match[1])
    .sort();

  it("lists the nine commands", () => {
    expect(cliCommandNames()).toEqual([
      "build",
      "db:prepare",
      "dev",
      "i18n:check",
      "i18n:create",
      "i18n:delete",
      "i18n:update",
      "i18n:update:ai",
      "migrate",
    ]);
  });

  it("dispatches every command it validates, and validates every one it dispatches", () => {
    expect(dispatched).toEqual(cliCommandNames());
  });

  it("gives every command a usage line", () => {
    for (const name of cliCommandNames()) {
      expect(COMMAND_ARGUMENTS[name].usage).toMatch(
        new RegExp(`^vitnode ${name.replaceAll(":", ":")}`),
      );
    }
  });

  /**
   * A value-taking flag has to be one of the command's flags, or the value rule
   * would never be reached and `--model` would be refused as unknown.
   */
  it("declares no value flag it does not also allow", () => {
    for (const name of cliCommandNames()) {
      const spec = COMMAND_ARGUMENTS[name];

      for (const flag of spec.valueFlags ?? []) {
        expect(spec.flags).toContain(flag);
      }
    }
  });
});

describe("valid invocations are accepted, and stay accepted", () => {
  it.each([
    ["build"],
    ["db:prepare"],
    ["dev"],
    ["migrate"],
    ["migrate", "--generate"],
    ["i18n:check"],
    ["i18n:check", "--ci"],
    ["i18n:create"],
    ["i18n:delete"],
    ["i18n:update"],
    ["i18n:update:ai"],
  ])("%s %s", (...argv) => {
    expect(refusal(...argv)).toBeNull();
  });

  it("parses the command and hands the arguments through unchanged", () => {
    expect(accepted("migrate", "--generate")).toEqual({
      args: ["--generate"],
      command: "migrate",
    });
    expect(accepted("i18n:check", "--ci")).toEqual({
      args: ["--ci"],
      command: "i18n:check",
    });
    expect(accepted("migrate")).toEqual({ args: [], command: "migrate" });
  });

  /**
   * The three commands that parse their own `argv`, and the reason the contract
   * is not "no arguments" for all nine.
   *
   * `i18n:create` reads `[code, ...nameParts]` and joins the tail into a name,
   * `i18n:delete` reads one code, and `i18n:update:ai` takes locale codes plus
   * `--model` / `--concurrency`. All of it is existing, documented, scriptable
   * behaviour - anything supplied skips a prompt, which is what lets these run
   * on a non-interactive stdin - so validation must not take it away.
   */
  it.each([
    ["i18n:create", "pl"],
    ["i18n:create", "pl", "Polski"],
    ["i18n:create", "pt-BR", "Português", "do", "Brasil"],
    ["i18n:delete", "pl"],
    ["i18n:update:ai", "pl"],
    ["i18n:update:ai", "pl", "de"],
    ["i18n:update:ai", "--model", "gpt-5"],
    ["i18n:update:ai", "--model=gpt-5"],
    ["i18n:update:ai", "pl", "--model", "gpt-5", "--concurrency", "4"],
    ["i18n:update:ai", "--concurrency=4"],
  ])("%s %s %s %s", (...argv) => {
    expect(refusal(...argv)).toBeNull();
  });
});

describe("an unknown flag is refused", () => {
  it.each([
    ["build", "--foo"],
    ["db:prepare", "--foo"],
    ["dev", "--foo"],
    ["migrate", "--foo"],
    ["i18n:check", "--foo"],
    ["i18n:create", "--foo"],
    ["i18n:delete", "--foo"],
    ["i18n:update", "--foo"],
    ["i18n:update:ai", "--foo"],
  ])("%s %s", (...argv) => {
    expect(refusal(...argv)).not.toBeNull();
  });

  it("names the argument, the command and the flags that would have worked", () => {
    const message = refusal("migrate", "--foo");

    expect(message).toContain('"--foo"');
    expect(message).toContain('"migrate"');
    expect(message).toContain("--generate");
  });

  it("says plainly when a command accepts no arguments at all", () => {
    const message = refusal("db:prepare", "--generate");

    expect(message).toContain('"db:prepare"');
    expect(message).toContain("accepts no arguments");
  });

  it("refuses a short flag rather than counting it as a positional", () => {
    expect(refusal("i18n:delete", "-x")).not.toBeNull();
  });

  /**
   * Flags belong to commands, not to the CLI. A whitelist shared across
   * commands would make both of these legal ways to ask for nothing.
   */
  it.each([
    ["migrate", "--ci"],
    ["i18n:check", "--generate"],
    ["i18n:update:ai", "--ci"],
    ["i18n:check", "--model", "gpt-5"],
  ])("%s %s is not another command's flag", (...argv) => {
    expect(refusal(...argv)).not.toBeNull();
  });
});

describe("extra positional arguments are refused", () => {
  it.each([
    ["build", "hello"],
    ["db:prepare", "anything"],
    ["dev", "anything"],
    ["migrate", "foo"],
    ["migrate", "--generate", "extra"],
    ["i18n:check", "foo"],
    ["i18n:check", "--ci", "foo"],
    ["i18n:update", "foo"],
    ["i18n:delete", "pl", "de"],
  ])("%s %s %s", (...argv) => {
    expect(refusal(...argv)).not.toBeNull();
  });

  it("counts a consumed flag value as a value, not a positional", () => {
    // `4` belongs to `--concurrency`. Counting it as a locale code would refuse
    // an invocation the implementation has always accepted.
    expect(refusal("i18n:update:ai", "--concurrency", "4")).toBeNull();
  });
});

describe("repeated and malformed flags are refused", () => {
  it.each([
    ["migrate", "--generate", "--generate"],
    ["migrate", "--generate", "--foo"],
    ["i18n:check", "--ci", "--ci"],
    ["i18n:check", "--ci", "--foo"],
    ["i18n:update:ai", "--model", "a", "--model", "b"],
  ])("%s %s %s %s %s", (...argv) => {
    expect(refusal(...argv)).not.toBeNull();
  });

  it("names the repeated flag", () => {
    expect(refusal("migrate", "--generate", "--generate")).toContain(
      "repeated",
    );
  });

  it("refuses a value flag with no value", () => {
    expect(refusal("i18n:update:ai", "--model")).toContain("needs a value");
    expect(refusal("i18n:update:ai", "--model=")).toContain("needs a value");
    expect(
      refusal("i18n:update:ai", "--model", "--concurrency", "4"),
    ).toContain("needs a value");
  });

  it("refuses a value on a switch that takes none", () => {
    expect(refusal("migrate", "--generate=yes")).toContain("takes no value");
    expect(refusal("i18n:check", "--ci=true")).toContain("takes no value");
  });

  it("checks every argument, not only the first", () => {
    // The bug this guards: returning as soon as one flag validates leaves the
    // rest of the list unread. `--model=gpt-5` carries its own value and so is
    // the one flag with nothing to consume.
    expect(refusal("i18n:update:ai", "--model=gpt-5", "--foo")).not.toBeNull();
    expect(
      refusal("i18n:update:ai", "--model", "gpt-5", "--foo"),
    ).not.toBeNull();
  });
});

describe("a missing or unknown command is refused", () => {
  it("refuses no command at all", () => {
    const message = refusal();

    expect(message).toContain("No command given");
    // `undefined` must not read as a command name in the message.
    expect(message).not.toContain("undefined");
  });

  it("refuses an empty command", () => {
    expect(refusal("")).toContain("No command given");
  });

  it("refuses an unknown command and says what exists", () => {
    const message = refusal("wat");

    expect(message).toContain('"wat"');
    expect(message).toContain("db:prepare");
  });

  /**
   * Never part of this CLI's contract, and this task is validation rather than
   * feature expansion - so they are refused like any other unknown command.
   */
  it.each(["--help", "-h", "--version", "-v"])("refuses %s", spelling => {
    expect(refusal(spelling)).not.toBeNull();
  });

  it("refuses a command spelled as a flag's value", () => {
    expect(refusal("--generate")).not.toBeNull();
  });

  it("does not accept a command by prototype inheritance", () => {
    // `Object.hasOwn`, not `name in table`: `toString` and `constructor` are on
    // every object's prototype and are not commands.
    expect(refusal("toString")).toContain("Command not found");
    expect(refusal("constructor")).toContain("Command not found");
  });
});

/**
 * The semantic regression this whole change exists for.
 *
 * `migrate --generat` must not become `migrate`. The old entry point compared
 * one string to `"--generate"`, and a typo failed that comparison and fell
 * through to the full bootstrap - generate, apply *and seed*, against whatever
 * `POSTGRES_URL` names. Somebody who meant "write the migration files" got a
 * migrated and seeded database.
 *
 * `i18n:check --cii` is the same failure with a quieter cost: `isCi` was false,
 * so a CI job that had asked for a hard failure got a soft report and exit 0.
 */
describe("a mistyped flag never becomes a different command", () => {
  it("refuses `migrate --generat` rather than running a full migration", () => {
    const parsed = parseCliArguments(["migrate", "--generat"]);

    expect(parsed.ok).toBe(false);
    // And the refusal is not quietly equivalent to the bare command.
    expect(parsed).not.toEqual(parseCliArguments(["migrate"]));
  });

  it.each(["--generat", "--generate-", "--Generate", "-generate", "generate"])(
    "refuses `migrate %s`",
    spelling => {
      expect(refusal("migrate", spelling)).not.toBeNull();
    },
  );

  it("refuses `i18n:check --cii` rather than running a non-CI check", () => {
    const parsed = parseCliArguments(["i18n:check", "--cii"]);

    expect(parsed.ok).toBe(false);
    expect(parsed).not.toEqual(parseCliArguments(["i18n:check"]));
  });

  it.each(["--cii", "--c", "--CI", "-ci", "ci"])(
    "refuses `i18n:check %s`",
    spelling => {
      expect(refusal("i18n:check", spelling)).not.toBeNull();
    },
  );

  /**
   * The accepted spelling is the only one that turns the behaviour on, which is
   * what the entry point reads. Stated here so the pairing cannot drift: if
   * `args` ever carried an unvalidated token, this is the assertion that fails.
   */
  it("only ever hands the exact spelling through", () => {
    expect(accepted("migrate", "--generate")?.args).toEqual(["--generate"]);
    expect(accepted("migrate")?.args).toEqual([]);
    expect(accepted("i18n:check", "--ci")?.args).toEqual(["--ci"]);
    expect(accepted("i18n:check")?.args).toEqual([]);
  });
});

/**
 * That the parser is in front of the dispatch, read off the entry point.
 *
 * Three assertions and no spawned process. The property is positional - "the
 * check happens before the work" - and it is the one thing a call to
 * `parseCliArguments` cannot demonstrate about its own caller.
 */
describe("the entry point validates before it dispatches", () => {
  const withoutComments = codeOf("scripts.ts");

  it("calls the parser, and does so above the switch", () => {
    const parse = withoutComments.indexOf("parseCliArguments(");
    const guard = withoutComments.indexOf("!parsed.ok");
    const dispatch = withoutComments.indexOf("switch (command)");

    expect(parse).toBeGreaterThan(-1);
    expect(guard).toBeGreaterThan(parse);
    expect(dispatch).toBeGreaterThan(guard);
  });

  /**
   * The old reads, both gone. `process.argv[3]` as "the flag" is what let every
   * argument after the third be ignored, and it is the shape a future edit is
   * most likely to reintroduce.
   */
  it("reads the whole argv rather than one indexed argument", () => {
    expect(withoutComments).toContain("process.argv.slice(2)");
    expect(withoutComments).not.toMatch(/process\.argv\[\d]/);
  });

  /**
   * No command implementation may be called with a raw argument. The commands
   * that need one read the validated list; the three that parse their own
   * `argv` are simply never started on an `argv` the parser refused.
   */
  it("passes no unvalidated argument to a command", () => {
    expect(withoutComments).toContain('args.includes("--ci")');
    expect(withoutComments).toContain('args.includes("--generate")');
    expect(withoutComments).not.toMatch(/i18nCheck\(\s*flag\s*\)/);
    expect(withoutComments).not.toMatch(/flag\s*===\s*"--generate"/);
  });
});
