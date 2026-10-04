// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { offenders, SRC_ROOT } from "@/tests/import-graph";

const here = dirname(fileURLToPath(import.meta.url));

/** What a browser bundle must never pull in through the payments entry point. */
const SERVER_ONLY = [
  "drizzle-orm",
  "hono",
  "node:crypto",
  "postgres",
  "stripe",
  "@/vitnode.config",
];

const sourcesUnder = (directory: string): string[] =>
  readdirSync(directory).flatMap(name => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      return name === "node_modules" || name === "dist"
        ? []
        : sourcesUnder(path);
    }

    return /\.tsx?$/.test(name) ? [path] : [];
  });

describe("the payments entry point is browser-safe", () => {
  it("is checked by a walk that does see server modules", () => {
    // The control: the checkout service is server code, so a walk that reports
    // nothing for it would make the assertion below meaningless.
    expect(
      offenders(join(SRC_ROOT, "api/models/payments/checkout.ts"), SERVER_ONLY),
    ).not.toEqual([]);
  });

  it("reaches no server-only module", () => {
    expect(offenders(join(here, "index.ts"), SERVER_ONLY)).toEqual([]);
  });
});

describe("core stays provider-neutral", () => {
  it("never imports the Stripe SDK - adapters live in their own package", () => {
    const importsStripe = sourcesUnder(SRC_ROOT).filter(path =>
      /from\s+["']stripe["']|import\(\s*["']stripe["']\s*\)/.test(
        readFileSync(path, "utf8"),
      ),
    );

    expect(importsStripe).toEqual([]);
  });
});
