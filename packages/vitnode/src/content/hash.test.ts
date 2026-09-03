import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { clampWithFingerprint, fingerprint } from "./index";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "../..");

const manifest = JSON.parse(
  readFileSync(join(packageRoot, "package.json"), "utf8"),
) as { exports: Record<string, Record<string, string> | string> };

describe("the hashing helpers", () => {
  it("is deterministic and short", () => {
    expect(fingerprint("blog.post")).toBe(fingerprint("blog.post"));
    expect(fingerprint("blog.post")).not.toBe(fingerprint("blog.category"));
    expect(fingerprint("blog.post")).toHaveLength(7);
  });

  it("leaves a value under the limit alone", () => {
    expect(clampWithFingerprint("short", 63)).toBe("short");
  });

  /**
   * The property the clamp exists for: two long values differing only near the
   * end must not collapse onto one identifier.
   */
  it("keeps two long values distinct after clamping", () => {
    const a = `${"x".repeat(70)}_alpha`;
    const b = `${"x".repeat(70)}_beta`;

    expect(clampWithFingerprint(a, 63)).toHaveLength(63);
    expect(clampWithFingerprint(a, 63)).not.toBe(clampWithFingerprint(b, 63));
  });
});

/**
 * The canonical door. Everything in the AdminCP and the API reaches these two
 * through `@vitnode/core/content`, and that spelling is unchanged by the
 * rename - only the file behind it moved.
 */
describe("the public barrel", () => {
  it("still exports both names", () => {
    expect(typeof fingerprint).toBe("function");
    expect(typeof clampWithFingerprint).toBe("function");
  });

  it("re-exports them from ./hash", () => {
    const barrel = readFileSync(join(here, "index.ts"), "utf8");

    expect(barrel).toContain(
      'export { clampWithFingerprint, fingerprint } from "./hash";',
    );
  });
});

/**
 * `@vitnode/core/content/fingerprint` - the subpath consumers could reach
 * through the package-wide `./*` wildcard before the rename.
 *
 * The wildcard resolves `./content/fingerprint` to
 * `dist/src/content/fingerprint.js`, which no longer exists, so the old
 * spelling would have become a "module not found" for anybody outside this
 * repository. An explicit key restores it, and Node prefers an exact subpath
 * over any pattern - so this wins over `./*` wherever it is written in the map.
 *
 * A package export rather than a forwarding module, and that distinction is the
 * whole point: the mapping is resolved by the *package manager and bundler*, at
 * build time, and the file the browser is eventually asked for is `hash.js`. A
 * `fingerprint.ts` that re-exported `./hash` would satisfy the same imports and
 * put the blocked filename back on the wire.
 */
describe("the content/fingerprint compatibility subpath", () => {
  const entry = manifest.exports["./content/fingerprint"];

  it("is declared explicitly rather than left to the wildcard", () => {
    expect(entry).toBeDefined();
    expect(typeof entry).toBe("object");
  });

  it("points every condition at the hash module", () => {
    expect(entry).toEqual({
      import: "./dist/src/content/hash.js",
      types: "./dist/src/content/hash.d.ts",
      default: "./dist/src/content/hash.js",
    });
  });

  it("never names a file called fingerprint", () => {
    for (const target of Object.values(entry as Record<string, string>)) {
      expect(target).not.toMatch(/fingerprint/);
    }
  });

  it("resolves to the same module the barrel re-exports", () => {
    const canonical = manifest.exports["./content"];

    expect(typeof canonical).toBe("object");
    expect((entry as Record<string, string>).import).toBe(
      "./dist/src/content/hash.js",
    );
    // And the canonical barrel is a different module - the compatibility
    // subpath is the implementation, not a second copy of the index.
    expect((canonical as Record<string, string>).import).toBe(
      "./dist/src/content/index.js",
    );
  });
});

describe("the renamed source file", () => {
  it("is hash.ts", () => {
    expect(existsSync(join(here, "hash.ts"))).toBe(true);
  });

  it("has no fingerprint.ts beside it", () => {
    expect(existsSync(join(here, "fingerprint.ts"))).toBe(false);
  });
});
