export interface TerminalStream {
  columns?: number;
  isTTY?: boolean;
  write: (chunk: string) => boolean;
}

export interface TerminalInput {
  isTTY?: boolean;
}

/** What the terminal the CLI is writing to can do. */
export interface TerminalCapabilities {
  /** Running under a CI provider. */
  ci: boolean;
  /** ANSI colors are allowed. */
  color: boolean;
  columns: number;
  /** A person can answer prompts and watch a spinner. */
  interactive: boolean;
  /** Box-drawing and symbol glyphs render. */
  unicode: boolean;
}

type Env = Record<string, string | undefined>;

const isTruthy = (value: string | undefined): boolean =>
  value !== undefined && value !== "" && value !== "0" && value !== "false";

/** The same providers `ci-info` checks first, without the dependency. */
export const isCi = (env: Env): boolean =>
  isTruthy(env.CI) ||
  isTruthy(env.CONTINUOUS_INTEGRATION) ||
  isTruthy(env.BUILD_NUMBER) ||
  isTruthy(env.RUN_ID) ||
  isTruthy(env.GITHUB_ACTIONS) ||
  isTruthy(env.GITLAB_CI) ||
  isTruthy(env.BUILDKITE) ||
  isTruthy(env.TF_BUILD);

/**
 * `is-unicode-supported`, inlined: everything but the legacy Windows console
 * and the Linux virtual console draws the glyphs.
 */
export const isUnicodeSupported = (env: Env, platform: string): boolean => {
  if (platform !== "win32") return env.TERM !== "linux";

  return (
    isTruthy(env.WT_SESSION) ||
    isTruthy(env.TERMINUS_SUBLIME) ||
    env.ConEmuTask === "{cmd::Cmder}" ||
    env.TERM_PROGRAM === "Terminus-Sublime" ||
    env.TERM_PROGRAM === "vscode" ||
    env.TERM === "xterm-256color" ||
    env.TERM === "alacritty" ||
    env.TERMINAL_EMULATOR === "JetBrains-JediTerm"
  );
};

export interface DetectTerminalOptions {
  env: Env;
  /** `--plain`: no color, no animation, stable lines. */
  plain?: boolean;
  platform: string;
  stdin: TerminalInput;
  stdout: TerminalStream;
}

/**
 * Decides what the CLI may draw.
 *
 * `NO_COLOR` always wins over `FORCE_COLOR`, because it is the user's setting
 * and `FORCE_COLOR` is usually a tool's. Interactivity needs *both* ends to be
 * a terminal: piping the output into a file must not leave a prompt waiting on
 * a keyboard nobody is at.
 */
export const detectTerminal = ({
  env,
  platform,
  plain = false,
  stdin,
  stdout,
}: DetectTerminalOptions): TerminalCapabilities => {
  const ci = isCi(env);
  const dumb = env.TERM === "dumb";
  const tty = stdout.isTTY === true && !dumb;

  const color =
    !plain &&
    !("NO_COLOR" in env && env.NO_COLOR !== "") &&
    (isTruthy(env.FORCE_COLOR) || tty);

  return {
    ci,
    color,
    columns: stdout.columns ?? 80,
    interactive: !plain && !ci && tty && stdin.isTTY === true,
    unicode: !plain && isUnicodeSupported(env, platform),
  };
};
