// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { createFakeRuntime } from "../testing";
import { stripAnsi } from "./colors";
import { detectTerminal } from "./terminal";
import { createUi } from "./ui";

const uiFor = ({
  env = {},
  interactive = false,
  mode = "pretty" as const,
}: {
  env?: Record<string, string>;
  interactive?: boolean;
  mode?: "plain" | "pretty";
} = {}) => {
  const runtime = createFakeRuntime({ env, interactive });
  const timers = {
    clear: vi.fn(),
    set: vi.fn(() => 1 as unknown as ReturnType<typeof setInterval>),
  };
  let now = 0;
  const ui = createUi({
    capabilities: detectTerminal({
      env: runtime.env,
      plain: mode === "plain",
      platform: "linux",
      stdin: runtime.stdin,
      stdout: runtime.stdout,
    }),
    mode,
    now: () => now,
    stderr: runtime.stderr,
    stdout: runtime.stdout,
    timers,
  });

  return {
    advance: (ms: number) => {
      now += ms;
    },
    runtime,
    timers,
    ui,
  };
};

describe("pretty output", () => {
  it("prints the VitNode header and status lines with symbols", () => {
    const { runtime, ui } = uiFor();

    ui.header("Production build");
    ui.success("Plugins validated");
    ui.warning("Something to look at");

    expect(runtime.output()).toBe(
      "\n◆ VitNode\n  Production build\n\n  ✓ Plugins validated\n  ! Something to look at\n",
    );
  });

  it("writes errors to stderr, not stdout", () => {
    const { runtime, ui } = uiFor();

    ui.error("Build failed");

    expect(runtime.output()).toBe("");
    expect(runtime.errors()).toBe("✖ Build failed\n");
  });

  it("emits no ANSI codes when colors are disabled", () => {
    const { runtime, ui } = uiFor({
      env: { NO_COLOR: "1" },
      interactive: true,
    });

    ui.success("Done");
    ui.table({ columns: [{ header: "A" }], rows: [["b"]] });

    expect(runtime.raw()).toBe(stripAnsi(runtime.raw()));
  });
});

describe("plain output", () => {
  it("uses stable tags instead of symbols and colors", () => {
    const { runtime, ui } = uiFor({ interactive: true, mode: "plain" });

    ui.header("Production build");
    ui.success("Client built", "3.1s");
    ui.warning("admin.js 612.4 kB");
    ui.error("Nope");

    expect(runtime.output()).toBe(
      "VitNode - Production build\n[OK] Client built (3.1s)\n[WARN] admin.js 612.4 kB\n",
    );
    expect(runtime.errors()).toBe("[ERROR] Nope\n");
    expect(runtime.raw()).not.toContain("\x1b[");
  });
});

describe("tasks", () => {
  it("animates a spinner only in an interactive terminal", async () => {
    const interactive = uiFor({ interactive: true });
    const piped = uiFor();

    await interactive.ui.runTask(
      "Building client",
      async () => await Promise.resolve(undefined),
    );
    await piped.ui.runTask(
      "Building client",
      async () => await Promise.resolve(undefined),
    );

    expect(interactive.timers.set).toHaveBeenCalledOnce();
    expect(interactive.timers.clear).toHaveBeenCalledOnce();
    expect(piped.timers.set).not.toHaveBeenCalled();
    expect(piped.runtime.raw()).not.toContain("\r");
  });

  it("ends with the elapsed time", () => {
    const { advance, runtime, ui } = uiFor();
    const task = ui.task("Building client");

    advance(3100);
    task.succeed();

    expect(runtime.output()).toBe("  ✓ Building client  3.1s\n");
  });

  it("reports a failed task and rethrows its error", async () => {
    const { runtime, ui } = uiFor();

    await expect(
      ui.runTask("Building client", async () => {
        await Promise.resolve();
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(runtime.output()).toBe("  ✖ Building client\n");
  });

  it("prints lines above a running spinner instead of through it", () => {
    const { runtime, ui } = uiFor({ interactive: true });
    const task = ui.task("Working");

    ui.line("a request");
    task.succeed("Worked", "1s");

    expect(runtime.output()).toContain("a request\n");
    expect(runtime.output()).toContain("✓ Worked  1s\n");
  });
});
