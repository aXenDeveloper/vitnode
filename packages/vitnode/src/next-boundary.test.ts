// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  HOST_ROUTERS,
  NEXT_INTL,
  NEXT_ONLY,
  NEXT_SPECIMEN,
  offenders,
  reachedSpecifiers,
  runtimeImports,
  stripComments,
} from "@/tests/import-graph";

/**
 * The invariant Stage 17 bought, asserted over the whole package at once.
 *
 * Fourteen `*-boundaries.test.ts` files used to police one subtree each, because
 * each was written when that subtree was split in two and had a Next.js half to
 * point at. This one makes the claim those halves used to make impossible: a
 * *whole package* claim, over every source file rather than over the graph a
 * walk from a handful of entry points happens to cover.
 *
 * Stage 18 finished the trade. The subtree suites kept the part only they can
 * assert - that a shared component takes its framework parts as props - and
 * handed this file everything they were saying about `next/*`, `next-intl`, the
 * React `server-only` marker and the deleted halves. Two of them had nothing
 * else left and are gone; the rest are half their old size. What is here now is
 * one scanner with one set of controls, which matters more than the line count:
 * a negative assertion passes by finding less, so four private copies of a
 * reachability walk were four chances to pass for the wrong reason.
 *
 * It also absorbs what `lib/next-cache/inventory.test.ts` did. That file listed
 * six Next-cache entries with a `deleteWhen` condition each and failed when the
 * list stopped being true; every condition is now met, so the list is replaced
 * by the assertion it was counting down to - there is no Next.js cache code, and
 * the framework-neutral cache is still here.
 */

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = here;
const packageRoot = resolve(here, "..");
const repoRoot = resolve(packageRoot, "../..");

const SOURCE = /\.[cm]?[jt]sx?$/;

const filesUnder = (dir: string): string[] => {
  if (!existsSync(dir)) return [];

  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      return [".turbo", "dist", "node_modules", "test-fixtures"].includes(
        entry.name,
      )
        ? []
        : filesUnder(path);
    }

    return SOURCE.test(entry.name) ? [path] : [];
  });
};

/**
 * Every specifier named anywhere in a file, including the ones only a test
 * writes.
 *
 * Broader than `runtimeImports` on purpose. That function answers "what does
 * this module load", which is the right question for a reachability walk and the
 * wrong one here: `vi.mock("next/headers")` loads nothing, but a file that
 * mocks a Next.js module is a file still written against Next.js, and it would
 * survive an import-only scan indefinitely.
 */
const namedSpecifiers = (path: string): string[] => {
  const source = stripComments(readFileSync(path, "utf8"));

  return [
    ...source.matchAll(
      /(?:from|import|require|vi\.mock|vi\.doMock|jest\.mock)\s*\(?\s*["']([^"']+)["']/g,
    ),
  ].map(match => match[1]);
};

const isForbidden = (specifier: string, forbidden: string[]): boolean =>
  forbidden.some(one => specifier === one || specifier.startsWith(`${one}/`));

/** The permanent source trees this package's claim covers. */
const PERMANENT_TREES = [
  join(packageRoot, "src"),
  join(packageRoot, "scripts"),
  join(repoRoot, "plugins/blog/src"),
  join(repoRoot, "plugins/example/src"),
];

/**
 * The two files that have to name the specifiers everything else may not.
 *
 * A scanner cannot forbid `"server-only"` without writing `"server-only"`, and
 * this file's lexer cases are quoted fragments of real source. Both are excluded
 * the way a linter's own fixtures are excluded from linting - and the list is
 * asserted below to be exactly these two, so it cannot quietly grow into a place
 * to hide a genuine import.
 */
const SCANNER_FILES = [
  join(packageRoot, "src/tests/import-graph.ts"),
  join(packageRoot, "src/next-boundary.test.ts"),
];

const permanentFiles = PERMANENT_TREES.flatMap(filesUnder).filter(
  path => !SCANNER_FILES.includes(path),
);

describe("the scanner still detects what these suites assert the absence of", () => {
  /**
   * Controls, and the reason they point at a fixture.
   *
   * Every other assertion in this file, and every graph assertion left in a
   * subtree suite, is "found nothing" - which a scanner that silently matches
   * nothing satisfies completely. Each subtree suite used to keep a positive
   * control aimed at the Next.js half of its own subtree, and Stage 17 deleted
   * every one of those halves. Re-pointing the controls at production code would
   * only defer the problem to whoever deletes the next specimen, so they live
   * here, once, aimed at a fixture that exists to be found.
   *
   * `test-fixtures/next-specimen/` exists for this and nothing else. It is
   * outside `tsconfig.json`'s `include`, so `next` need not be installed, and
   * outside `src`, so no reachability walk can pick it up.
   */
  it("finds a static next/* import two hops away", () => {
    expect(offenders(NEXT_SPECIMEN, NEXT_ONLY)).toContain(
      "next/headers in ../test-fixtures/next-specimen/entry.ts -> ../test-fixtures/next-specimen/hop.ts",
    );
  });

  it("finds a dynamic import(), not just static ones", () => {
    // `next/dynamic` reached a shared module exactly this way once: inside a
    // confirm dialog, behind a delete button, three files from the edit.
    expect(offenders(NEXT_SPECIMEN, ["next/navigation"])).not.toEqual([]);
  });

  it("finds a bare side-effect import", () => {
    expect(offenders(NEXT_SPECIMEN, ["server-only"])).not.toEqual([]);
  });

  it("finds next-intl's server entrypoint", () => {
    expect(offenders(NEXT_SPECIMEN, NEXT_INTL)).not.toEqual([]);
  });

  it("walks past the entry file rather than reading it alone", () => {
    // The entry itself imports only `./hop`. Everything above is found one edge
    // in, so a scanner that never followed an edge would fail all four.
    expect(runtimeImports(NEXT_SPECIMEN)).toEqual(["./hop"]);
  });

  it("does not mistake @tanstack/react-start/server-only for server-only", () => {
    // Whole-segment matching, not `startsWith` on the raw string. The TanStack
    // marker is permitted and is what `src/tanstack/*/server.ts` uses.
    expect(isForbidden("@tanstack/react-start/server-only", NEXT_ONLY)).toBe(
      false,
    );
    expect(isForbidden("server-only", NEXT_ONLY)).toBe(true);
    expect(isForbidden("next/headers", NEXT_ONLY)).toBe(true);
    expect(isForbidden("next-intl", NEXT_ONLY)).toBe(false);
  });
});

describe("the scanner reads source, not prose about source", () => {
  /**
   * The lexer's own cases, because it is the part with logic.
   *
   * Every one of these came from a real file in this package rather than from
   * imagination: two of them failed the package-wide scan on first run, and both
   * failures were the scan reporting a Next.js import inside a comment or a
   * regex explaining that there wasn't one.
   */
  it("drops a line comment without eating the URL after it", () => {
    expect(
      stripComments("// see https://next-intl.dev/docs\nconst a = 1;"),
    ).toBe("\nconst a = 1;");
  });

  it("drops a doc comment that quotes an import", () => {
    const source =
      '/** `@/lib/fetcher` carries `import "server-only"`. */\nexport const a = 1;';

    expect(stripComments(source)).not.toContain("server-only");
  });

  it("keeps a string literal that happens to contain a comment opener", () => {
    expect(stripComments('const url = "https://example.com/a";')).toContain(
      "https://example.com/a",
    );
  });

  it("drops a regex literal containing a quote", () => {
    // `provider-records.test.ts` line for line. Read as a string, the `"` opens
    // a literal that runs to the next quote three lines down.
    const source =
      'expect(x).not.toMatch(/from "next-intl/);\nimport y from "./real";';
    const stripped = stripComments(source);

    expect(stripped).not.toContain("next-intl");
    expect(stripped).toContain('from "./real"');
  });

  it("does not mistake division for a regex", () => {
    expect(
      stripComments('const half = total / 2;\nimport a from "./real";'),
    ).toContain('from "./real"');
  });

  it("preserves line numbering across a block comment", () => {
    const source = "a;\n/* one\ntwo\nthree */\nb;";

    expect(stripComments(source).split("\n")).toHaveLength(
      source.split("\n").length,
    );
  });
});

describe("no permanent source file names Next.js", () => {
  it("scans a source tree that is actually populated", () => {
    // Guards the guard: an empty file list makes every `it.each` below vacuous.
    expect(permanentFiles.length).toBeGreaterThan(500);
  });

  it("excludes exactly the two files that must name what it forbids", () => {
    // Pinned so the exemption cannot grow. Both must also still exist - an
    // exclusion for a deleted path is an exclusion nobody notices is wrong.
    expect(
      SCANNER_FILES.map(path => relative(packageRoot, path)).sort(),
    ).toEqual(["src/next-boundary.test.ts", "src/tests/import-graph.ts"]);
    for (const path of SCANNER_FILES) expect(existsSync(path)).toBe(true);
  });

  it("imports nothing from next or next/*", () => {
    const found = permanentFiles
      .flatMap(path =>
        namedSpecifiers(path)
          .filter(specifier => isForbidden(specifier, ["next"]))
          .map(specifier => `${specifier} in ${relative(repoRoot, path)}`),
      )
      .sort();

    expect(found).toEqual([]);
  });

  it("imports nothing from next-intl, at any entrypoint", () => {
    // Including the root entry. It re-exports `use-intl` unchanged, so it was
    // harmless in the strict sense - but it made `next-intl` a real dependency
    // of a framework-neutral package, and `components/ui/{carousel,pagination}`
    // read their `use-intl` context from its module record rather than from the
    // one `apps/web` provides into. A production build merged the chunks and hid
    // it; `vite dev` did not.
    //
    // This is the assertion `shell-boundaries.test.ts` existed for, and the
    // reason it is worth stating over the whole package rather than over one
    // subtree: the two modules that actually broke the AdminCP were
    // `components/ui/sidebar` and `components/ui/sheet` - shadcn primitives
    // nobody thinks of as host-coupled, several imports below the shell that
    // failed. A scan aimed at the shell found them by luck. This one cannot
    // miss them.
    const found = permanentFiles
      .flatMap(path =>
        namedSpecifiers(path)
          .filter(specifier => isForbidden(specifier, NEXT_INTL))
          .map(specifier => `${specifier} in ${relative(repoRoot, path)}`),
      )
      .sort();

    expect(found).toEqual([]);
  });

  it("imports the npm server-only marker nowhere", () => {
    // A Next.js convention with a package name. Server separation here is the
    // `content/` versus `content/server/` split plus
    // `@tanstack/react-start/server-only` in `src/tanstack/*/server.ts`, which
    // is a different package and stays.
    const found = permanentFiles
      .flatMap(path =>
        namedSpecifiers(path)
          .filter(specifier => specifier === "server-only")
          .map(() => relative(repoRoot, path)),
      )
      .sort();

    expect(found).toEqual([]);
  });

  it("declares no 'use server' or 'use cache' directive", () => {
    // Both are Next.js compiler directives. All 29 `"use server"` modules were
    // thin wrappers around a fetcher call plus `revalidatePath`, and each had a
    // TanStack counterpart reaching Hono directly; the two `"use cache"`
    // functions were the Next auth and search reads.
    const found = permanentFiles
      .filter(path =>
        /^\s*["'](use server|use cache)["']\s*;?\s*$/m.test(
          readFileSync(path, "utf8"),
        ),
      )
      .map(path => relative(repoRoot, path))
      .sort();

    expect(found).toEqual([]);
  });
});

describe("the Next.js source trees are gone rather than emptied", () => {
  it.each([
    ["the legacy route areas", "src/routes"],
    ["the Next cache handlers", "src/lib/next-cache"],
    ["the Content Engine's Next adapter", "src/content/next"],
    ["the Next config factory", "config"],
    ["next-intl's locale-aware router", "src/lib/navigation.ts"],
    ["the server-only fetcher", "src/lib/fetcher.ts"],
  ])("%s", (_label, path) => {
    expect(existsSync(join(packageRoot, path))).toBe(false);
  });
});

/**
 * Every Next.js half Stage 17 deleted, pinned in one list.
 *
 * Each of these paths was the one place in its subtree where a Next.js API was
 * allowed to appear, and each was named by its own `*-boundaries.test.ts` so
 * that the suite could notice one coming back. Stage 18 moved the naming here
 * and left those suites the part only they can assert - that the shared half
 * takes its framework parts as props.
 *
 * The move is the point. Split across twelve files, the list was twelve
 * `DELETED_NEXT_HALF` constants that no reader ever saw together, each
 * surrounded by a subtree scan that `namedSpecifiers` above already covers over
 * the whole package. Together it is an inventory: this is the shape of the
 * application that used to be here, and none of it is.
 *
 * A path graduating off this list is a real decision, not a cleanup. The
 * filename is free again once nothing remembers it - but re-using
 * `header.tsx` beside `header-content.tsx` is how the split got confusing the
 * first time, so the entry stays until somebody argues otherwise.
 */
describe("the deleted Next.js halves stay deleted", () => {
  const DELETED = [
    "components/form/fields/input-roles-next.tsx",
    "components/form/fields/search-roles.action.server.ts",
    "components/switchers/langs/language-switcher.tsx",
    "components/table/data-table.tsx",
    "components/table/navigation-next.tsx",
    // The four request-scope reads. Each was `next/headers` plus a fetch, and
    // each is now a TanStack `createServerFn` in the host or a query in core.
    "lib/api/get-middleware-api.ts",
    "lib/api/get-moderator-permissions-api.ts",
    "lib/api/get-session-admin-api.ts",
    "lib/api/get-session-api.ts",
    "views/admin/layouts/breadcrumb/breadcrumb-admin.tsx",
    "views/admin/layouts/search/get-search-nav-items.tsx",
    "views/admin/layouts/search/search.tsx",
    "views/admin/layouts/sidebar/nav/item.tsx",
    "views/admin/layouts/sidebar/nav/nav.tsx",
    "views/admin/layouts/sidebar/sidebar.tsx",
    "views/admin/layouts/user-bar/user-bar.tsx",
    "views/auth/password-reset/change-password-form/form.tsx",
    "views/auth/password-reset/form/form.tsx",
    "views/auth/settings/devices/devices-list.tsx",
    "views/auth/settings/devices/devices.tsx",
    "views/auth/settings/nav.tsx",
    "views/auth/settings/shell.tsx",
    "views/auth/sign-in/form/form.tsx",
    "views/auth/sign-in/sign-in-card.tsx",
    "views/auth/sign-up/form/form.tsx",
    "views/auth/sign-up/sign-up-card.tsx",
    "views/auth/sso/buttons/client.tsx",
    "views/auth/sso/callback/client/client.tsx",
    "views/breadcrumb/breadcrumb-main.tsx",
    "views/files/my-files-table-view.tsx",
    "views/layouts/provider.tsx",
    "views/layouts/theme/header/header-next.tsx",
    "views/layouts/theme/header/header.tsx",
    "views/layouts/theme/header/user/next-user-header.tsx",
    "views/layouts/theme/layout.tsx",
    "views/search/search-controls.tsx",
    "views/search/search-feed.tsx",
  ];

  it("names every subtree the split touched", () => {
    // Guards the guard: this list replaced twelve smaller ones, and a truncated
    // version of it would pass every assertion below.
    expect(DELETED.length).toBeGreaterThanOrEqual(37);
  });

  it("keeps the surviving half of each pair, so the list is about the right files", () => {
    // A pair whose *shared* half also vanished would satisfy the deletions
    // below while meaning the feature is gone, not migrated.
    for (const survivor of [
      "components/form/fields/input-roles.tsx",
      "components/table/data-table-content.tsx",
      "views/auth/settings/shell-content.tsx",
      "views/layouts/providers.tsx",
      "views/layouts/theme/header/header-content.tsx",
      "views/layouts/theme/layout-content.tsx",
      "views/search/search-feed-content.tsx",
    ]) {
      expect(existsSync(join(srcRoot, survivor))).toBe(true);
    }
  });

  it.each(DELETED)("%s", path => {
    expect(existsSync(join(srcRoot, path))).toBe(false);
  });
});

describe("@vitnode/core stays framework-neutral", () => {
  const manifest = JSON.parse(
    readFileSync(join(packageRoot, "package.json"), "utf8"),
  ) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    exports: Record<string, unknown>;
    keywords: string[];
    peerDependencies: Record<string, string>;
    peerDependenciesMeta: Record<string, unknown>;
  };

  it("declares next and next-intl in no dependency field", () => {
    // A manifest scan, not a resolution: the lockfile will keep the word `next`
    // for as long as any third party declares it as an optional peer, and that
    // is not this package's dependency.
    for (const field of [
      "dependencies",
      "devDependencies",
      "peerDependencies",
      "peerDependenciesMeta",
    ] as const) {
      expect(
        Object.keys(manifest[field]).filter(name =>
          /^next(-intl)?$/.test(name),
        ),
      ).toEqual([]);
    }
  });

  it("exports no entrypoint that resolves into deleted Next code", () => {
    expect(
      Object.keys(manifest.exports).filter(
        subpath =>
          subpath.startsWith("./content/next") ||
          subpath === "./config/next.config",
      ),
    ).toEqual([]);
  });

  /**
   * Two export subpaths whose names invite exactly the wrong deletion.
   *
   * `./content/admin-form` points into `views/`, which is where the Next.js
   * screens lived - but it is the framework-neutral Content Engine layout API,
   * and `plugins/blog` imports it. `./content/fingerprint` points at `hash.js`
   * rather than a `fingerprint.ts`, which is an intentional compatibility
   * mapping and not a stale path.
   */
  it.each([
    ["./content/admin-form", "src/views/admin/views/content/form/index.ts"],
    ["./content/fingerprint", "src/content/hash.ts"],
    ["./content", "src/content/index.ts"],
    ["./content/server", "src/content/server/index.ts"],
  ])("%s resolves to a file that exists", (subpath, source) => {
    expect(manifest.exports[subpath]).toBeDefined();
    expect(existsSync(join(packageRoot, source))).toBe(true);
  });

  it("no longer advertises next.js as a keyword", () => {
    expect(manifest.keywords).not.toContain("next.js");
  });

  it("keeps the framework-neutral cache, which is a different thing entirely", () => {
    // `api/lib/cache.ts` is VitNode's own cache, reached as `c.get("cache")`
    // over HTTP, with its own namespace and lifetime. It shares a word with
    // `lib/next-cache/` and nothing else, and nothing from that directory was
    // renamed into it.
    expect(existsSync(join(srcRoot, "api/lib/cache.ts"))).toBe(true);
    // The value import lives in the client; `cache.ts` takes redis' types only,
    // which `runtimeImports` erases - so the reachability assertion has to name
    // the module that actually loads the package.
    expect(
      reachedSpecifiers(join(srcRoot, "api/lib/cache-client.ts")),
    ).toContain("redis");
  });

  it("keeps the framework-free content revalidation dispatcher", () => {
    // Runs in the Hono process, where `next/cache` throws on import. Only the
    // Route Handler at the far end went.
    const dispatcher = join(srcRoot, "content/server/revalidate-dispatch.ts");

    expect(existsSync(dispatcher)).toBe(true);
    expect(offenders(dispatcher, [...NEXT_ONLY, ...NEXT_INTL])).toEqual([]);
  });
});

describe("core reaches navigation through a seam, not a router", () => {
  /**
   * The injected `LinkComponent` architecture, as an assertion.
   *
   * Around twenty components take a link component and a pathname as props so
   * that this package renders in a host that is not this repository's. Nothing
   * enforced it before except the fact that core could not import a router
   * without breaking the Next.js app; with one host left, that accident is gone
   * and the rule needs stating.
   *
   * `src/tanstack/**` is exempt and must be: it is the namespace whose entire
   * job is binding core to TanStack Start.
   */
  const neutral = filesUnder(join(packageRoot, "src")).filter(
    path =>
      !path.startsWith(join(packageRoot, "src/tanstack")) &&
      !SCANNER_FILES.includes(path),
  );

  it("covers the tree outside src/tanstack", () => {
    expect(neutral.length).toBeGreaterThan(400);
  });

  it("imports no host router outside src/tanstack", () => {
    const found = neutral
      .flatMap(path =>
        namedSpecifiers(path)
          .filter(specifier => isForbidden(specifier, HOST_ROUTERS))
          .map(specifier => `${specifier} in ${relative(packageRoot, path)}`),
      )
      .sort();

    expect(found).toEqual([]);
  });
});
