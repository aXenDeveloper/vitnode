import pc from "picocolors";

type Paint = (text: string) => string;

/**
 * The CLI's whole palette, by meaning rather than by hue.
 *
 * Commands never reach for a color directly: a "warning" is yellow because this
 * file says so, which is what keeps the output from drifting into a rainbow.
 */
export interface Palette {
  bold: Paint;
  /** Commands, URLs and paths a developer may copy. */
  command: Paint;
  error: Paint;
  /** Secondary text: timings, hints, labels. */
  muted: Paint;
  /** VitNode's own name and section markers. */
  primary: Paint;
  success: Paint;
  warning: Paint;
}

export const createPalette = (enabled: boolean): Palette => {
  const colors = pc.createColors(enabled);

  return {
    bold: colors.bold,
    command: colors.cyan,
    error: colors.red,
    muted: colors.gray,
    primary: text => colors.bold(colors.blue(text)),
    success: colors.green,
    warning: colors.yellow,
  };
};

// oxlint-disable-next-line no-control-regex
const ANSI_PATTERN = /\x1b\[[0-9;?]*[A-Za-z]/g;

export const stripAnsi = (text: string): string =>
  text.replace(ANSI_PATTERN, "");

/**
 * The printed width of a line.
 *
 * Everything the CLI draws is ASCII or a single-width symbol, so the length
 * without escape codes is the width - no East Asian width table needed.
 */
export const visibleWidth = (text: string): number => stripAnsi(text).length;

export const padEnd = (text: string, width: number): string =>
  text + " ".repeat(Math.max(0, width - visibleWidth(text)));

export const padStart = (text: string, width: number): string =>
  " ".repeat(Math.max(0, width - visibleWidth(text))) + text;
