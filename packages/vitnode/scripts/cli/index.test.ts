// @vitest-environment node
import { describe, expect, it } from "vitest";

import { PUBLIC_COMMANDS } from "./help";
import { runCli } from "./index";
import { createFakeRuntime } from "./testing";

const run = async (
  argv: string[],
  options: Parameters<typeof createFakeRuntime>[0] = {},
) => {
  const runtime = createFakeRuntime(options);
  const code = await runCli(argv, runtime);

  return {
    code,
    errors: runtime.errors(),
    output: runtime.output(),
    raw: runtime.raw(),
  };
};

describe("vitnode", () => {
  it("prints the root help and succeeds", async () => {
    const { code, output } = await run([]);

    expect(code).toBe(0);
    expect(output).toMatchInlineSnapshot(`
      "
        ◆ VitNode
        Build extensible applications and communities.

      Usage
        vitnode <command> [options]

      Commands
        dev                Start the development environment
        build              Build for production
        start              Start the production server
        plugin create      Create a plugin
        plugin list        List plugins
        plugin validate    Validate plugins
        db generate        Generate a migration
        db migrate         Run pending migrations
        db push            Push schema changes (development)
        db status          Show migration status

      Examples
        vitnode dev
        vitnode plugin create blog
        vitnode build --analyze

      Run vitnode <command> --help for a command's options.
      "
    `);
  });

  it("prints the same help for --help", async () => {
    expect((await run(["--help"])).output).toBe((await run([])).output);
    expect((await run(["--help"])).code).toBe(0);
  });

  it("prints the version", async () => {
    const { code, output } = await run(["--version"]);

    expect(code).toBe(0);
    expect(output.trim()).toBe("1.2.3-test");
  });

  it("lists only the public commands - legacy names keep working but stay out of help", async () => {
    const { output } = await run([]);

    expect(PUBLIC_COMMANDS.every(({ name }) => output.includes(name))).toBe(
      true,
    );
    expect(output).not.toContain("db:prepare");
    expect(output).not.toContain("i18n:");
  });

  it("never mentions out-of-scope commands", async () => {
    const { output } = await run([]);

    for (const command of [
      "doctor",
      "info",
      "seed",
      "cache",
      "update",
      "enable",
      "disable",
    ]) {
      expect(output).not.toMatch(new RegExp(`\\b${command}\\b`));
    }
  });
});

describe("usage errors", () => {
  it("refuses an unknown command with exit code 2 and a hint", async () => {
    const { code, errors } = await run(["deploy"]);

    expect(code).toBe(2);
    expect(errors).toContain("✖ unknown command 'deploy'");
    expect(errors).toContain("vitnode --help");
  });

  it("suggests the closest command for a typo", async () => {
    expect((await run(["biuld"])).errors).toContain("Did you mean build?");
  });

  it("refuses an unknown flag on a known command", async () => {
    const { code, errors } = await run(["build", "--minify"]);

    expect(code).toBe(2);
    expect(errors).toContain("unknown option '--minify'");
  });

  it("refuses an unknown subcommand", async () => {
    const { code, errors } = await run(["db", "seed"]);

    expect(code).toBe(2);
    expect(errors).toContain("unknown command 'seed'");
  });

  it("reports errors in plain mode when asked to, without colors", async () => {
    const { errors, raw } = await run(["build", "--plain", "--minify"], {
      interactive: true,
    });

    expect(errors).toContain("[ERROR] unknown option '--minify'");
    expect(raw).not.toContain("\x1b[");
  });

  it("keeps the old flag validation of the legacy commands", async () => {
    expect((await run(["i18n:check", "--cii"])).code).toBe(2);
    expect((await run(["migrate", "--generat"])).code).toBe(2);
  });
});

describe("command help", () => {
  it.each([
    ["build", ["--analyze", "--plain", "--verbose"]],
    ["dev", ["--port", "--host"]],
    ["start", ["--port", "--host"]],
    ["db", ["generate", "migrate", "push", "status"]],
    ["plugin", ["create", "list", "validate"]],
  ])("vitnode %s --help documents its options", async (command, expected) => {
    const { code, output } = await run([command, "--help"]);

    expect(code).toBe(0);
    expected.forEach(option => {
      expect(output).toContain(option);
    });
  });

  it("documents the production guard of db push", async () => {
    const { output } = await run(["db", "push", "--help"]);

    expect(output).toContain("--force");
    expect(output).toContain("--accept-data-loss");
  });
});

describe("errors from commands", () => {
  it("explains a missing project instead of printing a stack", async () => {
    const { code, errors } = await run(["build"], { cwd: "/" });

    expect(code).toBe(1);
    expect(errors).toContain("✖ No package.json found");
    expect(errors).not.toContain("    at ");
  });
});
