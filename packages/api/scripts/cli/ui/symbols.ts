export interface Symbols {
  active: string;
  arrow: string;
  bar: string;
  brand: string;
  bullet: string;
  corner: string;
  dot: string;
  error: string;
  fn: string;
  large: string;
  line: string;
  pending: string;
  spinner: readonly string[];
  success: string;
  tee: string;
  warning: string;
}

const UNICODE: Symbols = {
  active: "◇",
  arrow: "→",
  bar: "│",
  brand: "◆",
  bullet: "•",
  corner: "└",
  dot: "●",
  error: "✖",
  fn: "ƒ",
  large: "▲",
  line: "─",
  pending: "○",
  spinner: ["◒", "◐", "◓", "◑"],
  success: "✓",
  tee: "├",
  warning: "!",
};

const ASCII: Symbols = {
  active: "o",
  arrow: "->",
  bar: "|",
  brand: "*",
  bullet: "-",
  corner: "`-",
  dot: "*",
  error: "x",
  fn: "f",
  large: "^",
  line: "-",
  pending: "o",
  spinner: ["-", "\\", "|", "/"],
  success: "+",
  tee: "+",
  warning: "!",
};

export const createSymbols = (unicode: boolean): Symbols =>
  unicode ? UNICODE : ASCII;
