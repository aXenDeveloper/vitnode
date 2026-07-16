import { beforeEach, describe, expect, it, vi } from "vitest";

const { runInteractiveShellCommand } = vi.hoisted(() => ({
  runInteractiveShellCommand: vi.fn(),
}));

vi.mock("./run-interactive-shell-command.js", () => ({
  runInteractiveShellCommand,
}));

import { buildPlugin } from "./build";

describe("buildPlugin", () => {
  beforeEach(() => {
    runInteractiveShellCommand.mockReset();
    runInteractiveShellCommand.mockResolvedValue(true);
  });

  it("runs tsc, swc and tsc-alias in order", async () => {
    await buildPlugin();

    expect(runInteractiveShellCommand.mock.calls.map(call => call[0])).toEqual([
      "tsc",
      "swc",
      "tsc-alias",
    ]);
  });

  it("passes the build tsconfig and swc config to the tools", async () => {
    await buildPlugin();

    expect(runInteractiveShellCommand).toHaveBeenNthCalledWith(1, "tsc", [
      "-p",
      "tsconfig.build.json",
    ]);
    expect(runInteractiveShellCommand).toHaveBeenNthCalledWith(2, "swc", [
      "src",
      "-d",
      "dist",
      "--config-file",
      ".swcrc",
    ]);
    expect(runInteractiveShellCommand).toHaveBeenNthCalledWith(3, "tsc-alias", [
      "-p",
      "tsconfig.build.json",
    ]);
  });

  it("stops on the first failing step", async () => {
    runInteractiveShellCommand.mockReset();
    runInteractiveShellCommand.mockRejectedValueOnce(new Error("tsc failed"));

    await expect(buildPlugin()).rejects.toThrow("tsc failed");
    expect(runInteractiveShellCommand).toHaveBeenCalledTimes(1);
  });
});
