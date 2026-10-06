import { isAbsolute, relative } from "node:path";

import { errorMessage, RuntimeError } from "../errors";
import { toDisplayPath } from "../ui/format";

/** The fields Rollup, Rolldown and Vite attach to a build error. */
interface BundlerError {
  code?: string;
  frame?: string;
  id?: string;
  loc?: { column?: number; file?: string; line?: number };
  plugin?: string;
}

export interface BuildErrorContextOptions {
  /** What the build printed before it failed, shown under the error. */
  output?: string;
  /** The VitNode plugin a file belongs to, or `null`. */
  pluginOf: (file: string) => null | string;
  root: string;
}

const firstLines = (text: string, count: number) =>
  text.trim().split(/\r?\n/).slice(0, count);

/**
 * Turns a failed build into a `RuntimeError` that says where it failed.
 *
 * Only adds what the error itself carries: the file and position the bundler
 * reported, the bundler plugin that threw, and - when that file is inside a
 * configured VitNode plugin - the plugin's name. Nothing is guessed from the
 * message. The original error stays the `cause`, so `--verbose` still prints
 * its full stack.
 */
export const describeBuildError = (
  error: unknown,
  { output, pluginOf, root }: BuildErrorContextOptions,
): RuntimeError => {
  const bundler = (
    typeof error === "object" && error !== null ? error : {}
  ) as BundlerError;
  const file = bundler.loc?.file ?? bundler.id;
  const details: string[] = [];

  if (file !== undefined && isAbsolute(file.split("?")[0] ?? file)) {
    const path = file.split("?")[0] ?? file;
    const plugin = pluginOf(path);
    if (plugin !== null) details.push(`Plugin   ${plugin}`);

    const position =
      bundler.loc?.line === undefined
        ? ""
        : `:${String(bundler.loc.line)}${bundler.loc.column === undefined ? "" : `:${String(bundler.loc.column)}`}`;
    details.push(`File     ${toDisplayPath(relative(root, path))}${position}`);
  }

  if (bundler.plugin !== undefined) details.push(`Step     ${bundler.plugin}`);

  const message = firstLines(errorMessage(error), 12);
  if (details.length > 0) details.push("");
  details.push(...message);

  if (bundler.frame !== undefined) {
    details.push("", ...firstLines(bundler.frame, 12));
  }

  return new RuntimeError("Build failed", {
    cause: error,
    details,
    hint: "Run with --verbose for the full stack trace and the bundler's own log.",
    output: output?.trim() === "" ? undefined : output,
  });
};
