// @vitest-environment node
import { existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const srcRoot = resolve(import.meta.dirname, "../..");

/**
 * The provider contract: the modules a host mounts to boot `@vitnode/core`.
 *
 * This list is the thing worth pinning. Every one of these is imported by name
 * from an application's root - not through a barrel, not through a re-export -
 * so renaming one is a breaking change that nothing in this package notices,
 * because nothing in this package imports them either. They are leaves of the
 * graph pointing outward.
 *
 * What this file used to do as well was walk that list looking for `next/*`, and
 * it carried its own ninety-line copy of the import scanner to do it - a fourth
 * `resolveModule`, a fourth `runtimeImports`, a fourth reachability walk, all
 * drifted slightly from `@/tests/import-graph`. The claim is now
 * `next-boundary.test.ts`'s, over every file in the package rather than over
 * these fourteen, which leaves this file the part only it knows: which modules a
 * host is entitled to find.
 *
 * Adding to the list is fine, and is how a new provider becomes part of the
 * contract. Removing an entry means an application's root import stops
 * resolving, so it wants a note in the release rather than a green test.
 */
const PROVIDER_CONTRACT = [
  "components/languages-provider.tsx",
  "components/theme-provider.tsx",
  "components/theme-script.tsx",
  "components/ui/sonner.tsx",
  "components/ui/tooltip.tsx",
  "lib/i18n/load-messages.ts",
  "lib/i18n/pick-messages.ts",
  "lib/i18n/sources.ts",
  "lib/metadata.ts",
  "lib/query-client.ts",
  "views/layouts/providers.tsx",
  "views/layouts/rate-limit-listener.tsx",
  "vitnode.config.ts",
  "ws/provider.tsx",
];

describe("the provider contract resolves", () => {
  it("still names every module a host boots with", () => {
    // Guards the guard: a truncated list passes each assertion below.
    expect(PROVIDER_CONTRACT.length).toBeGreaterThanOrEqual(14);
  });

  it.each(PROVIDER_CONTRACT)("%s", relativePath => {
    const path = join(srcRoot, relativePath);

    expect(existsSync(path)).toBe(true);
    expect(statSync(path).isFile()).toBe(true);
  });
});
