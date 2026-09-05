import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

/** `packages/vitnode/src`, which `@/` resolves against. */
export const SRC_ROOT = resolve(
  dirname(new URL(import.meta.url).pathname),
  "..",
);

const CANDIDATE_SUFFIXES = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

export const resolveSpecifier = (
  specifier: string,
  from: string,
  srcRoot: string = SRC_ROOT,
): null | string => {
  let base: string;

  if (specifier.startsWith("@/")) base = join(srcRoot, specifier.slice(2));
  else if (specifier.startsWith(".")) base = resolve(dirname(from), specifier);
  else return null;

  for (const suffix of CANDIDATE_SUFFIXES) {
    const candidate = base + suffix;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }

  return null;
};

export const stripComments = (source: string): string => {
  let out = "";
  let at = 0;

  const opensRegex = (): boolean => {
    for (let back = out.length - 1; back >= 0; back -= 1) {
      const previous = out[back];
      if (/\s/.test(previous)) continue;

      return !/[\w$)\]"'`]/.test(previous);
    }

    return true;
  };

  while (at < source.length) {
    const char = source[at];
    const next = source[at + 1];

    if (char === "/" && next === "/") {
      while (at < source.length && source[at] !== "\n") at += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      at += 2;
      while (
        at < source.length &&
        !(source[at] === "*" && source[at + 1] === "/")
      ) {
        // Newlines are kept so line numbers in a failure message stay honest.
        if (source[at] === "\n") out += "\n";
        at += 1;
      }
      at += 2;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      const quote = char;
      out += char;
      at += 1;
      while (at < source.length && source[at] !== quote) {
        if (source[at] === "\\") {
          out += source[at] + (source[at + 1] ?? "");
          at += 2;
          continue;
        }
        out += source[at];
        at += 1;
      }
      out += quote;
      at += 1;
      continue;
    }

    if (char === "/" && opensRegex()) {
      // Consumed but not emitted: a regex body may hold quotes, and emitting
      // them would reopen the exact confusion this branch exists to prevent.
      // Nothing in a regex is ever an import specifier.
      at += 1;
      let inClass = false;
      while (at < source.length) {
        const inner = source[at];
        if (inner === "\\") {
          at += 2;
          continue;
        }
        if (inner === "[") inClass = true;
        else if (inner === "]") inClass = false;
        else if (inner === "/" && !inClass) break;
        else if (inner === "\n") break; // Unterminated: not a regex after all.
        at += 1;
      }
      at += 1;
      continue;
    }

    out += char;
    at += 1;
  }

  return out;
};

export const runtimeImports = (path: string): string[] => {
  const source = stripComments(readFileSync(path, "utf8")).replace(
    /(^|[\n;])\s*import\s+type\s[\s\S]*?from\s*["'][^"']+["']/g,
    "$1",
  );

  return [
    ...source.matchAll(
      /(?:^|[^\w$.])from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']|(?:^|[\n;}])\s*import\s*["']([^"']+)["']|require\s*\(\s*["']([^"']+)["']/g,
    ),
  ]
    .map(match => match[1] ?? match[2] ?? match[3] ?? match[4])
    .filter((specifier): specifier is string => Boolean(specifier));
};

export const externalGraph = (
  entry: string,
  srcRoot: string = SRC_ROOT,
): Map<string, string[]> => {
  const found = new Map<string, string[]>();
  const parents = new Map<string, string>();
  const seen = new Set<string>();

  const chain = (file: string): string => {
    const parts: string[] = [];
    for (let at: string | undefined = file; at; at = parents.get(at)) {
      parts.unshift(relative(srcRoot, at));
    }

    return parts.join(" -> ");
  };

  const walk = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);

    for (const specifier of runtimeImports(file)) {
      const target = resolveSpecifier(specifier, file, srcRoot);

      if (target) {
        if (!parents.has(target)) parents.set(target, file);
        walk(target);
        continue;
      }

      found.set(specifier, [...(found.get(specifier) ?? []), chain(file)]);
    }
  };

  walk(entry);

  return found;
};

/** Every external specifier an entry can reach, without the chains. */
export const reachedSpecifiers = (
  entry: string,
  srcRoot: string = SRC_ROOT,
): string[] => [...externalGraph(entry, srcRoot).keys()];

/** A package and its subpaths, so `next` matches `next/headers` but not `next-intl`. */
const matches = (specifier: string, forbidden: string): boolean =>
  specifier === forbidden || specifier.startsWith(`${forbidden}/`);

/**
 * Every forbidden specifier an entry reaches, as `"<specifier> in <chain>"`.
 *
 * Sorted so a failure diff is stable, and formatted so the message names both
 * what was reached and the path that reached it.
 */
export const offenders = (
  entry: string,
  forbidden: string[],
  srcRoot: string = SRC_ROOT,
): string[] =>
  [...externalGraph(entry, srcRoot)]
    .filter(([specifier]) => forbidden.some(one => matches(specifier, one)))
    .flatMap(([specifier, chains]) => chains.map(at => `${specifier} in ${at}`))
    .sort();

/**
 * Anything that only resolves inside a Next.js application.
 *
 * `server-only` sits beside `next` because it throws in exactly the same place:
 * its `default` export is a module that exists to fail when a client component
 * imports it, so it is a Next.js convention with a package name rather than a
 * package that happens to be useful elsewhere.
 *
 * Not to be confused with `@tanstack/react-start/server-only`, which is a
 * different package and is permitted - `matches` compares whole path segments,
 * so `server-only` never matches it.
 */
export const NEXT_ONLY = ["next", "server-only"];

/**
 * `next-intl`, all of it.
 *
 * The root entry is included now, which is the one thing that changed at the
 * cutover. It used to be deliberately absent because it re-exports `use-intl`
 * unchanged, so importing it was harmless in the strict sense - but it made
 * `next-intl` a real dependency of a framework-neutral package, and it was the
 * reason `components/ui/{carousel,pagination}.tsx` read a `use-intl` context
 * from a second module record that nothing in `apps/web` provided into. Both now
 * import `use-intl` directly, and nothing in this package may name `next-intl`
 * again.
 */
export const NEXT_INTL = ["next-intl"];

/**
 * Routers a framework-neutral module may not import.
 *
 * `@vitnode/core` renders in whatever host mounts it, and it reaches navigation
 * through an injected `LinkComponent` prop and a supplied `pathname` rather than
 * through a router of its own. That seam is what lets one AdminCP shell serve
 * a host that is not this repository's - and importing any router here would
 * quietly close it, because the component would keep working in the one
 * application that happens to provide that router.
 */
export const HOST_ROUTERS = [
  "@tanstack/react-router",
  "@tanstack/react-start",
  "next",
  "react-router",
  "react-router-dom",
];

/** The committed Next.js import graph the controls scan. See its own docstring. */
export const NEXT_SPECIMEN = resolve(
  SRC_ROOT,
  "../test-fixtures/next-specimen/entry.ts",
);
