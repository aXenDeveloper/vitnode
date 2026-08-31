import { beforeEach, describe, expect, it, vi } from "vitest";

const { spawn } = vi.hoisted(() => ({
  spawn: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  default: { spawn },
  spawn,
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
      ["src", "-d", "dist", "--config-file", ".swcrc", "--copy-files", "-w"],
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

  /**
   * The route copier is gone, and `vitnode dev` must not grow it back.
   *
   * It used to start a fourth process - a chokidar watcher copying the plugin's
   * `src/routes/{main,admin,blank,breadcrumb}/` into every Next.js app's
   * `src/app/`. Asserting the exact list rather than a count, because what would
   * regress here is a *named* watcher reappearing, and the name is the evidence.
   */
  it("spawns no fourth process for copying route files anywhere", () => {
    devPlugin({ initMessage: "dev" });

    expect(spawn).toHaveBeenCalledTimes(3);
  });
});
