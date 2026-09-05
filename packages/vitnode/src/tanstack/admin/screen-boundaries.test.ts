// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "../../..");
const srcRoot = resolve(here, "../..");

/**
 * Packages that only resolve inside a Next.js application - the package and
 * everything under it.
 */
const NEXT_PACKAGES = ["next", "next-intl", "server-only"];

const NEXT_MODULES = ["@/lib/fetcher", "@/lib/navigation"];

const ALLOWED_PREFIX = "@tanstack/react-start/server-only";

const isForbidden = (specifier: string): boolean => {
  if (specifier.startsWith(ALLOWED_PREFIX)) return false;
  if (NEXT_MODULES.includes(specifier)) return true;

  return NEXT_PACKAGES.some(
    entry => specifier === entry || specifier.startsWith(`${entry}/`),
  );
};

/** The specifier a `from "..."` resolves to, or `null` when it leaves the package. */
const resolveSpecifier = (specifier: string, from: string): null | string => {
  let base: string;

  if (specifier.startsWith("@/")) base = join(srcRoot, specifier.slice(2));
  else if (specifier.startsWith(".")) base = resolve(dirname(from), specifier);
  else return null;

  for (const suffix of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const candidate = base + suffix;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }

  return existsSync(base) && statSync(base).isFile() ? base : null;
};

/**
 * Every specifier a file imports **at runtime**.
 *
 * `import type` statements are stripped first: a screen legitimately imports a
 * Next.js module's *types* - `zodSendTestEmailSchema` off an API route, the
 * plugin config's shape - and those are erased at compile time rather than
 * reaching a bundle.
 */
const runtimeImports = (path: string): string[] => {
  const source = readFileSync(path, "utf8").replace(
    /(?:^|\n)\s*(?:import|export)\s+type\s[\s\S]*?\sfrom\s*["'][^"']+["']/g,
    "\n",
  );

  return [
    ...source.matchAll(
      /(?:^|[^\w$.])from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']|(?:^|[\n;}])\s*import\s*["']([^"']+)["']/g,
    ),
  ]
    .map(match => match[1] ?? match[2] ?? match[3])
    .filter((specifier): specifier is string => Boolean(specifier));
};

/**
 * The first chain from `entry` to something a browser cannot load, or `null`.
 *
 * Returns the whole path rather than the offending file, because "which import
 * pulled this in" is the only question anyone reading this failure has.
 */
const forbiddenChain = (entry: string): null | string[] => {
  const seen = new Set<string>();
  const queue: { path: string; trail: string[] }[] = [
    { path: entry, trail: [relative(packageRoot, entry)] },
  ];

  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    const { path, trail } = next;
    if (seen.has(path)) continue;
    seen.add(path);

    for (const specifier of runtimeImports(path)) {
      if (isForbidden(specifier)) return [...trail, specifier];

      const imported = resolveSpecifier(specifier, path);
      if (imported) {
        queue.push({
          path: imported,
          trail: [...trail, relative(packageRoot, imported)],
        });
      }
    }
  }

  return null;
};

/** Every `tanstack/admin/<name>` directory - one per migrated AdminCP screen. */
const allScreens = readdirSync(here)
  .filter(name => statSync(join(here, name)).isDirectory())
  .filter(name => existsSync(join(here, name, "index.ts")))
  .sort((a, b) => a.localeCompare(b));

/**
 * Every screen, with no opt-out list.
 *
 * There was one while the migration ran in waves - the seven screens whose
 * graphs were clean, written out by hand so a screen joined the rule "the moment
 * its graph is clean". It is gone, and the reason it is gone is worth keeping,
 * because it is the failure the list itself produced.
 *
 * `roles` sat on the excluded side with a note naming its exact chain:
 *
 *     roles/index.ts -> roles/route.tsx -> roles-table-content.tsx
 *       -> role-form-content.tsx -> components/form/fields/color.tsx
 *       -> components/ui/color-picker.tsx -> next-intl
 *
 * The note ended "whoever migrates it will meet it". The screen was then
 * migrated and shipped, the colour picker was not swapped, and the exclusion
 * stopped describing future work and started hiding a live violation - on a
 * route `apps/web` serves. Nothing failed, because the one test that looks had
 * been told not to look there.
 *
 * So the list is derived. A screen is guarded by existing, which means a new one
 * is guarded before anybody remembers this file, and a screen whose graph goes
 * wrong fails here rather than being quietly added to an exception. If a future
 * screen genuinely cannot be clean yet, the honest move is a failing test and a
 * decision - not a name on a list.
 */
const screens = allScreens;

describe("this test is looking at the right tree", () => {
  it("finds every screen", () => {
    // The control: a scan that found no screens would pass every assertion
    // below. It is a floor rather than an exact list precisely so that adding a
    // screen does not require editing this test - which is what the old
    // allowlist made necessary, and what it got wrong.
    expect(screens.length).toBeGreaterThanOrEqual(10);
    expect(screens).toContain("cron");
    expect(screens).toContain("roles");
    expect(screens).toContain("users");
  });

  it("guards every screen that exists, with no exceptions", () => {
    // The rule this file exists to state. `allScreens` is the whole set, and
    // `screens` is what the assertions below actually walk; if the two ever
    // diverge, an opt-out has been reintroduced.
    expect(screens).toEqual(allScreens);
  });

  it("recognises the import it exists to forbid", () => {
    expect(isForbidden("server-only")).toBe(true);
    expect(isForbidden("@/lib/fetcher")).toBe(true);
    expect(isForbidden("next/navigation")).toBe(true);
    expect(isForbidden("next-intl/server")).toBe(true);
  });

  it("allows the Start marker a screen's server module needs", () => {
    expect(isForbidden("@tanstack/react-start/server-only")).toBe(false);
    expect(isForbidden("@/lib/fetcher-client")).toBe(false);
    // The browser fetcher is built out of these; forbidding them by prefix
    // would forbid the thing every screen is supposed to call.
    expect(isForbidden("@/lib/fetcher/rate-limit")).toBe(false);
    expect(isForbidden("@/lib/fetcher/core")).toBe(false);
  });
});

describe("an AdminCP screen reaches nothing Next.js-only", () => {
  it.each(screens)("%s", screen => {
    const chain = forbiddenChain(join(here, screen, "index.ts"));

    expect(chain, chain ? `chain: ${chain.join(" -> ")}` : undefined).toBe(
      null,
    );
  });
});

describe("the shell barrel reaches nothing Next.js-only either", () => {
  it("imports no Next.js module, directly or transitively", () => {
    // Every admin page loads this one, so it is the widest surface of the same
    // rule.
    const chain = forbiddenChain(join(here, "index.ts"));

    expect(chain, chain ? `chain: ${chain.join(" -> ")}` : undefined).toBe(
      null,
    );
  });
});
