// @vitest-environment node
import { describe, expect, it } from "vitest";

import { detectTerminal, isCi, isUnicodeSupported } from "./terminal";

const tty = { isTTY: true, write: () => true };
const pipe = { isTTY: false, write: () => true };

describe("detectTerminal", () => {
  it("draws colors, spinners and prompts in an interactive terminal", () => {
    expect(
      detectTerminal({ env: {}, platform: "linux", stdin: tty, stdout: tty }),
    ).toMatchObject({
      ci: false,
      color: true,
      interactive: true,
      unicode: true,
    });
  });

  it("respects NO_COLOR even when FORCE_COLOR is also set", () => {
    const { color } = detectTerminal({
      env: { FORCE_COLOR: "1", NO_COLOR: "1" },
      platform: "linux",
      stdin: tty,
      stdout: tty,
    });

    expect(color).toBe(false);
  });

  it("allows FORCE_COLOR to color redirected output", () => {
    const { color, interactive } = detectTerminal({
      env: { FORCE_COLOR: "1" },
      platform: "linux",
      stdin: pipe,
      stdout: pipe,
    });

    expect(color).toBe(true);
    expect(interactive).toBe(false);
  });

  it("never prompts or animates in CI, even on a TTY", () => {
    expect(
      detectTerminal({
        env: { GITHUB_ACTIONS: "true" },
        platform: "linux",
        stdin: tty,
        stdout: tty,
      }),
    ).toMatchObject({ ci: true, interactive: false });
  });

  it("does not prompt when stdin is not a terminal (piped input)", () => {
    expect(
      detectTerminal({ env: {}, platform: "linux", stdin: pipe, stdout: tty })
        .interactive,
    ).toBe(false);
  });

  it("turns everything off in plain mode", () => {
    expect(
      detectTerminal({
        env: {},
        plain: true,
        platform: "linux",
        stdin: tty,
        stdout: tty,
      }),
    ).toMatchObject({ color: false, interactive: false, unicode: false });
  });

  it("treats TERM=dumb as a non-terminal", () => {
    expect(
      detectTerminal({
        env: { TERM: "dumb" },
        platform: "linux",
        stdin: tty,
        stdout: tty,
      }),
    ).toMatchObject({ color: false, interactive: false });
  });
});

describe("isCi", () => {
  it("ignores CI=false", () => {
    expect(isCi({ CI: "false" })).toBe(false);
    expect(isCi({ CI: "1" })).toBe(true);
  });
});

describe("isUnicodeSupported", () => {
  it("falls back to ASCII on the legacy Windows console", () => {
    expect(isUnicodeSupported({}, "win32")).toBe(false);
    expect(isUnicodeSupported({ WT_SESSION: "1" }, "win32")).toBe(true);
  });

  it("falls back to ASCII on the Linux virtual console", () => {
    expect(isUnicodeSupported({ TERM: "linux" }, "linux")).toBe(false);
  });
});
