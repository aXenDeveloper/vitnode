// @vitest-environment node
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const PLUGIN_SRC = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(PLUGIN_SRC, "..", "..", "..");
const CORE_SRC = join(REPO_ROOT, "packages", "vitnode", "src");
const CORE_EDITOR = `${join(CORE_SRC, "editor")}/`;
const PAGE = join(PLUGIN_SRC, "pages", "zones-page.tsx");

const FORBIDDEN_ON_A_PUBLIC_PAGE = [
  "@dnd-kit/core",
  "@dnd-kit/modifiers",
  "@dnd-kit/sortable",
  "@dnd-kit/utilities",
  "cmdk",
  "drizzle-kit",
  "drizzle-orm",
  "hono",
  "postgres",
];

const fileAt = (base: string): null | string => {
  for (const suffix of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const candidate = base + suffix;

    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }

  return null;
};

const resolveSpecifier = (specifier: string, from: string): null | string => {
  if (specifier.startsWith("@vitnode/core/"))
    return fileAt(join(CORE_SRC, specifier.slice("@vitnode/core/".length)));

  if (specifier.startsWith("@/"))
    return fileAt(
      join(
        from.startsWith(`${CORE_SRC}/`) ? CORE_SRC : PLUGIN_SRC,
        specifier.slice(2),
      ),
    );

  if (specifier.startsWith("."))
    return fileAt(resolve(dirname(from), specifier));

  return null;
};

const importsOf = (file: string, dynamic: boolean): string[] => {
  const source = readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\b(?:import|export)\s+type\s[\s\S]*?from\s*["'][^"']+["']/g, "");

  return [
    ...source.matchAll(
      /(?:^|[^\w$.])from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']|(?:^|[\n;}])\s*import\s*["']([^"']+)["']/g,
    ),
  ]
    .filter(match => dynamic || match[2] === undefined)
    .map(match => match[1] ?? match[2] ?? match[3]);
};

interface ImportGraph {
  files: string[];
  specifiers: string[];
}

const graphOf = (entry: string, dynamic: boolean): ImportGraph => {
  const files = new Set<string>();
  const specifiers = new Set<string>();

  const walk = (file: string) => {
    if (files.has(file)) return;
    files.add(file);

    for (const specifier of importsOf(file, dynamic)) {
      const target = resolveSpecifier(specifier, file);

      if (target) walk(target);
      else specifiers.add(specifier);
    }
  };

  walk(entry);

  return { files: [...files].sort(), specifiers: [...specifiers].sort() };
};

describe("the real page that mounts this plugin's editable zones", () => {
  const eager = graphOf(PAGE, false);

  it("eagerly reaches no file under the visual editor", () => {
    expect(
      eager.files
        .filter(file => file.startsWith(CORE_EDITOR))
        .map(file => relative(REPO_ROOT, file)),
    ).toStrictEqual([]);
  });

  it("eagerly reaches no drag and drop, no command palette, no database", () => {
    expect(
      eager.specifiers.filter(specifier =>
        FORBIDDEN_ON_A_PUBLIC_PAGE.some(
          one => specifier === one || specifier.startsWith(`${one}/`),
        ),
      ),
    ).toStrictEqual([]);
  });

  it("does reach the editor once dynamic imports are followed, so this is not vacuous", () => {
    expect(graphOf(PAGE, true).specifiers).toContain("@dnd-kit/core");
  });
});
