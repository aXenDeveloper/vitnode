import { beforeEach, describe, expect, it, vi } from "vitest";

const { spawn } = vi.hoisted(() => ({
  spawn: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  default: { spawn },
  spawn,
}));

const { processPlugin } = vi.hoisted(() => ({
  processPlugin: vi.fn(),
}));

vi.mock("./plugin.js", () => ({
  processPlugin,
}));

import { devPlugin } from "./dev";

const createChild = () => ({
  on: vi.fn(),
  kill: vi.fn(),
});

const withPlatform = (platform: NodeJS.Platform, run: () => void) => {
  const original = Object.getOwnPropertyDescriptor(process, "platform");
  Object.defineProperty(process, "platform", { value: platform });
  try {
    run();
  } finally {
    if (original) {
      Object.defineProperty(process, "platform", original);
    }
  }
};

describe("devPlugin", () => {
  beforeEach(() => {
    spawn.mockReset();
    processPlugin.mockReset();
    spawn.mockImplementation(() => createChild());
  });

  it("spawns tsc, swc and tsc-alias watchers with split command and args", () => {
    devPlugin({ initMessage: "dev" });

    expect(spawn.mock.calls.map(call => call[0])).toEqual([
      "tsc",
      "swc",
      "tsc-alias",
    ]);
    expect(spawn).toHaveBeenNthCalledWith(
      1,
      "tsc",
      ["-w", "-p", "tsconfig.build.json", "--preserveWatchOutput"],
      expect.any(Object),
    );
    expect(spawn).toHaveBeenNthCalledWith(
      2,
      "swc",
      ["src", "-d", "dist", "--config-file", ".swcrc", "-w"],
      expect.any(Object),
    );
    expect(spawn).toHaveBeenNthCalledWith(
      3,
      "tsc-alias",
      ["-w", "-p", "tsconfig.build.json"],
      expect.any(Object),
    );
  });

  it("does not use a shell on non-Windows so kill terminates the real process", () => {
    withPlatform("linux", () => devPlugin({ initMessage: "dev" }));

    for (const call of spawn.mock.calls) {
      expect(call[2]).toMatchObject({ shell: false });
    }
  });

  it("uses a shell on Windows to run .cmd binaries", () => {
    withPlatform("win32", () => devPlugin({ initMessage: "dev" }));

    for (const call of spawn.mock.calls) {
      expect(call[2]).toMatchObject({ shell: true });
    }
  });

  it("delegates plugin processing with the init message", () => {
    devPlugin({ initMessage: "hello" });

    expect(processPlugin).toHaveBeenCalledWith({ initMessage: "hello" });
  });
});
