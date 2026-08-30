// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Every place this package still depends on a Next.js cache contract, declared
 * once so the final cleanup is a list rather than an investigation.
 *
 * ## Why this is a test and not a document
 *
 * A written inventory is accurate on the day it is written. This one fails when
 * it stops being true: a new `next/cache` import that nobody classified turns it
 * red, and so does deleting a file without striking it off. Stage 15 is meant to
 * be able to trust the list, and the only lists worth trusting are the checked
 * ones.
 *
 * ## The rule the inventory encodes
 *
 * Everything here is a **Next.js adapter**, not a VitNode cache. None of it may
 * be generalised, renamed into something framework-neutral and called from Hono
 * or from a TanStack Start host: a `revalidatePath` is a Next router instruction,
 * a `"use cache"` entry is a Next render, and the Redis handlers reproduce Next's
 * own key layout and tag arithmetic. The framework-neutral cache VitNode does own
 * is `api/lib/cache.ts`, reached as `c.get("cache")` over HTTP, with its own
 * namespace and its own lifetime.
 *
 * ## What each entry has to say
 *
 * `files` - what would be deleted. `consumers` - who still needs it today, which
 * is the reason it is still here. `deleteWhen` - the condition Stage 15 checks
 * before removing it. An entry with no consumer left is deletable; an entry whose
 * consumer still exists is not, however dead it looks.
 */
const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "../../..");
const sourceRoot = join(packageRoot, "src");

interface InventoryEntry {
  /** Who still reaches it. Empty means Stage 15 can take it. */
  consumers: string[];
  deleteWhen: string;
  /** Package-relative, from `src/`. */
  files: string[];
  id: string;
  /**
   * Which of this entry's {@link InventoryEntry.files} import `next/cache`.
   *
   * A subset rather than a flag, because "is this Next cache code" and "does this
   * file name `next/cache`" are different questions and an entry can hold both
   * kinds. `content-revalidation-bridge` is the case that forced it: the Route
   * Handler is Next-only through `server-only` and is deleted on the same
   * condition, but the module that actually calls `revalidateTag` is the one
   * beside it.
   *
   * Empty for the two tag modules: they are plain strings on purpose, so an
   * application can name the same tag its own `"use cache"` function was tagged
   * with. They are in the inventory because they exist *for* the Next caches, not
   * because they depend on one - which is why their deletion condition differs
   * from everything else here.
   */
  nextCacheImporters: string[];
}

/**
 * The Server Actions that call `revalidatePath` after a write.
 *
 * Named once and used as both the deletion list and the `next/cache` importer
 * list, because for this entry they are the same seventeen files: each is a
 * `"use server"` wrapper whose entire Next-specific content is the one line that
 * tells the router a route's data moved.
 */
const REVALIDATE_PATH_ACTIONS = [
  "views/admin/views/content/actions/mutation-api.server.ts",
  "views/admin/views/content/actions/translation-api.server.ts",
  "views/admin/views/core/advanced/cron/run-action/mutation-api.server.ts",
  "views/admin/views/core/dashboard/grid/save-layout.server.ts",
  "views/admin/views/core/debug/actions/clear-cache/mutation-api.server.ts",
  "views/admin/views/core/staff/staff-mutations.server.ts",
  "views/admin/views/core/system/files/actions/delete-action.server.ts",
  "views/admin/views/core/users/detail/user-mutations.server.ts",
  "views/admin/views/core/users/list/create-user.server.ts",
  "views/admin/views/core/users/list/verify-email.server.ts",
  "views/admin/views/core/users/roles/roles-mutations.server.ts",
  "views/auth/settings/devices/revoke-action.server.ts",
  "views/auth/sign-in/form/mutation-api.server.ts",
  "views/auth/sign-up/form/mutation-api.server.ts",
  "views/auth/sso/callback/client/mutation-api.server.ts",
  "views/files/actions/delete-action.server.ts",
  "views/layouts/theme/header/user/auth/log-out-mutation-api.server.ts",
];

const INVENTORY: InventoryEntry[] = [
  {
    id: "redis-cache-handlers",
    files: [
      "lib/next-cache/client.ts",
      "lib/next-cache/incremental-cache-handler.ts",
      "lib/next-cache/tags.ts",
      "lib/next-cache/use-cache-handler.ts",
    ],
    // By path, never by import: Next takes a cache handler as a module path, so
    // `next.config.ts` names the built file and nothing in `src/` references it.
    // That is what makes this the cheapest entry on the list to remove.
    consumers: ["config/next.config.ts"],
    deleteWhen: "config/next.config.ts stops setting cacheHandler(s)",
    nextCacheImporters: [],
  },
  {
    id: "content-revalidation-bridge",
    files: [
      "content/next/revalidate-route.server.ts",
      "content/next/revalidate.server.ts",
    ],
    // The Route Handler half of `content/server/revalidate-bridge.ts`: the API
    // process cannot call `next/cache`, so a scheduled publish posts to the web
    // app and *this* is what expires the tag. The bridge itself is framework-free
    // and stays - what goes is the Next endpoint on the other end of it.
    consumers: [
      "the host Next app's /api/vitnode/content/revalidate route",
      "views/admin/views/content/actions/mutation-api.server.ts",
    ],
    deleteWhen: "no Next.js web app serves CONTENT_REVALIDATE_PATH",
    nextCacheImporters: ["content/next/revalidate.server.ts"],
  },
  {
    id: "server-action-revalidate-path",
    files: REVALIDATE_PATH_ACTIONS,
    // Each is the Next half of a feature whose TanStack half already exists and
    // invalidates a Query root instead. They are not dead code: `apps/docs` and
    // any Next host still render `views/`, and a write there has to tell the
    // router something changed.
    consumers: ["the Next.js views/ surface (apps/docs and Next hosts)"],
    deleteWhen: "views/ no longer ships a Next.js Server Action surface",
    nextCacheImporters: REVALIDATE_PATH_ACTIONS,
  },
  {
    id: "use-cache-reads",
    files: ["lib/api/get-middleware-api.ts", "views/search/fetch-feed.ts"],
    // The only two `"use cache"` functions in the package. Both have a TanStack
    // counterpart already - `tanstack/auth/middleware-config.ts` and
    // `tanstack/search/*` - and both counterparts deliberately have no server
    // cache at all, reading the API on each request instead.
    consumers: [
      "views/auth/* sign-in, sign-up, SSO and recovery views",
      "views/search/search-view.tsx and discover-view.tsx",
    ],
    deleteWhen: "the Next.js auth and search views go",
    nextCacheImporters: [
      "lib/api/get-middleware-api.ts",
      "views/search/fetch-feed.ts",
    ],
  },
  {
    id: "search-feed-tag-write",
    files: ["views/admin/views/core/advanced/search/mutation-api.server.ts"],
    // `updateTag(SEARCH_FEED_TAG)` after a re-index. Listed apart from the
    // `revalidatePath` wrappers because it expires a *cache entry* rather than a
    // route, so it dies with `views/search/fetch-feed.ts` rather than with the
    // AdminCP's Next surface.
    consumers: ["views/search/fetch-feed.ts"],
    deleteWhen: "views/search/fetch-feed.ts goes",
    nextCacheImporters: [
      "views/admin/views/core/advanced/search/mutation-api.server.ts",
    ],
  },
  {
    id: "framework-free-tag-strings",
    files: ["content/cache.ts", "lib/cache-tags.ts"],
    // Plain strings and pure functions, with no `next/*` import between them.
    // They may outlive every entry above: an application tags its own cached
    // reads with the same values, and `content/server/revalidate-bridge.ts` -
    // which runs in the API, where `next/cache` throws on import - builds the tag
    // list for a background mutation out of `contentInvalidationTags`.
    consumers: [
      "content/server/revalidate-bridge.ts",
      "content/next/revalidate.server.ts",
      "views/admin/views/core/advanced/search/mutation-api.server.ts",
      "views/search/fetch-feed.ts",
      "host applications tagging their own cached reads",
    ],
    deleteWhen:
      "never on Next's account - only if the tag vocabulary itself is retired",
    nextCacheImporters: [],
  },
];

const SKIP_DIRECTORIES = ["dist", "node_modules"];

const filesUnder = (directory: string): string[] => {
  if (!existsSync(directory)) return [];

  const entries: string[] = [];

  for (const name of readdirSync(directory)) {
    const path = join(directory, name);

    if (statSync(path).isDirectory()) {
      if (SKIP_DIRECTORIES.includes(name)) continue;
      entries.push(...filesUnder(path));
      continue;
    }

    if (/\.tsx?$/.test(name) && !name.endsWith(".d.ts")) entries.push(path);
  }

  return entries;
};

const isTest = (path: string): boolean =>
  /\.test(-d)?\.tsx?$/.test(path) || path.includes(`${sep}tests${sep}`);

/**
 * Every specifier a file imports at runtime, type-only statements dropped.
 *
 * The same scanner the boundary tests use. Type-only lines are erased by the
 * compiler and followed by no bundler, and a `vi.mock("next/cache")` in a test is
 * not an import at all - neither belongs in an inventory of what would have to be
 * deleted.
 */
const importsFrom = (path: string): string[] =>
  [
    ...readFileSync(path, "utf8")
      .replace(
        /(?:^|\n)\s*(?:import|export)\s+type\s[\s\S]*?\sfrom\s*["'][^"']+["']/g,
        "\n",
      )
      .matchAll(
        /(?:^|[^\w$.])from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']|(?:^|[\n;}])\s*import\s*["']([^"']+)["']/g,
      ),
  ]
    .map(match => match[1] ?? match[2] ?? match[3])
    .filter((specifier): specifier is string => Boolean(specifier));

const runtimeSources = (): string[] =>
  filesUnder(sourceRoot).filter(path => !isTest(path));

/** Package-relative from `src/`, in the spelling the inventory uses. */
const asEntry = (path: string): string =>
  relative(sourceRoot, path).split(sep).join("/");

const importersOfNextCache = (): string[] =>
  runtimeSources()
    .filter(path =>
      importsFrom(path).some(
        specifier =>
          specifier === "next/cache" || specifier.startsWith("next/cache/"),
      ),
    )
    .map(asEntry)
    .sort();

describe("this test is looking at the right tree", () => {
  it("finds the package root", () => {
    expect(readFileSync(join(packageRoot, "package.json"), "utf8")).toContain(
      '"@vitnode/core"',
    );
  });

  it("has sources to scan", () => {
    expect(runtimeSources().length).toBeGreaterThan(100);
  });

  it("finds the next/cache imports that provably exist", () => {
    // The control. Every set assertion below would also be satisfied by a
    // scanner that silently matches nothing.
    expect(importersOfNextCache()).not.toEqual([]);
  });
});

describe("the Stage 15 deletion inventory is complete", () => {
  const declared = INVENTORY.flatMap(entry => entry.files);

  it.each(INVENTORY.map(entry => entry.id))("%s still exists", id => {
    const entry = INVENTORY.find(one => one.id === id);
    const missing = (entry?.files ?? []).filter(
      file => !existsSync(join(sourceRoot, file)),
    );

    // A file that has been deleted must be struck off the inventory in the same
    // change, or the list Stage 15 reads is already wrong.
    expect(missing).toEqual([]);
  });

  it("accounts for every next/cache import in the package", () => {
    // The assertion this file exists for. A new `next/cache` import anywhere in
    // `src/` has to be classified here - given a consumer and a deletion
    // condition - before it can be merged.
    const classified = [
      ...new Set(INVENTORY.flatMap(entry => entry.nextCacheImporters)),
    ].sort();

    expect(classified).toEqual(importersOfNextCache());
  });

  it("declares a consumer and a deletion condition for every entry", () => {
    // An entry with no consumer is deletable now, and leaving it on the list
    // hides that. An entry with no condition is one nobody can act on.
    expect(
      INVENTORY.filter(
        entry => entry.consumers.length === 0 || entry.deleteWhen === "",
      ).map(entry => entry.id),
    ).toEqual([]);
  });

  it("lists no file twice under two deletion conditions", () => {
    // One file, one condition. `mutation-api.server.ts` for the search screen is
    // the near-miss: it appears under `search-feed-tag-write` and nowhere else,
    // because what it writes dies with the feed rather than with the AdminCP.
    const seen = declared.filter(
      (file, index) => declared.indexOf(file) !== index,
    );

    expect(seen).toEqual([]);
  });
});

describe("the Redis cache handlers are reachable only by path", () => {
  const ADAPTER_DIRECTORY = "lib/next-cache";

  it("is imported by nothing in the package", () => {
    // What makes the adapters isolable rather than merely unused: no module in
    // `src/` names them, so no application graph can reach them by accident.
    // Next loads them through `next.config.ts` as a **file path**, which is a
    // reference no bundler and no import scan follows.
    const offenders = runtimeSources()
      .filter(path => !asEntry(path).startsWith(`${ADAPTER_DIRECTORY}/`))
      .filter(path =>
        importsFrom(path).some(specifier =>
          specifier.includes(ADAPTER_DIRECTORY),
        ),
      )
      .map(asEntry);

    expect(offenders).toEqual([]);
  });

  it("is where next.config.ts still points", () => {
    // The other half: the adapters are reachable *at all*. A rename that missed
    // this line would degrade every Next host to its in-memory cache silently,
    // because the config falls back when the file is not there.
    expect(
      readFileSync(join(packageRoot, "config/next.config.ts"), "utf8"),
    ).toContain(`dist/src/${ADAPTER_DIRECTORY}/`);
  });

  /**
   * The one deep reach into Next's own build output, pinned to a single file and
   * a single specifier.
   *
   * The incremental handler *wraps* Next's filesystem cache rather than replacing
   * it - prerendered pages stay on each instance's disk, which is deliberate -
   * so it has to load the class Next ships. That is the only Next dependency in
   * this directory, it is a dynamic import inside a `try`, and a Next version
   * that moves the file degrades to "no prerender cache" instead of failing to
   * boot.
   *
   * Everything else here declares its own copies of Next's contracts, which is
   * what lets `handlers.test.ts` drive them with a fake Redis and no framework at
   * all, and what makes `handlers.test-d.ts` - not the package build - the thing
   * that breaks when Next changes them.
   */
  const NEXT_INTERNAL =
    "next/dist/server/lib/incremental-cache/file-system-cache.js";

  it("reaches exactly one Next module, from exactly one file", () => {
    const reaches = filesUnder(join(sourceRoot, ADAPTER_DIRECTORY))
      .filter(path => !isTest(path))
      .flatMap(path =>
        importsFrom(path)
          .filter(
            specifier => specifier === "next" || specifier.startsWith("next/"),
          )
          .map(specifier => [asEntry(path), specifier]),
      );

    expect(reaches).toEqual([
      [`${ADAPTER_DIRECTORY}/incremental-cache-handler.ts`, NEXT_INTERNAL],
    ]);
  });

  it("loads it lazily rather than at module scope", () => {
    // Load-bearing: a top-level import would make a moved internal path a boot
    // failure for every Next host, and would pull Next into a module Next itself
    // has not finished loading.
    const source = readFileSync(
      join(sourceRoot, ADAPTER_DIRECTORY, "incremental-cache-handler.ts"),
      "utf8",
    );

    expect(source).toMatch(
      new RegExp(
        `await import\\(\\s*"${NEXT_INTERNAL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`,
      ),
    );
  });
});

describe("the two Redis namespaces cannot collide", () => {
  /**
   * The prefixes are read out of the source rather than imported.
   *
   * The API's is a private module constant, and importing the Next client would
   * pull `redis` in for a string comparison. What matters is that the two
   * literals disagree, and that is a property of the text.
   */
  const literal = (file: string, name: string): string => {
    const source = readFileSync(join(sourceRoot, file), "utf8");
    const match = new RegExp(
      `${name}\\s*(?::\\s*string)?\\s*=\\s*"([^"]+)"`,
    ).exec(source);

    expect(match, `${name} is declared in ${file}`).not.toBeNull();

    return match?.[1] ?? "";
  };

  const nextPrefix = () =>
    literal("lib/next-cache/client.ts", "NEXT_CACHE_PREFIX");
  const apiPrefix = () => literal("api/lib/cache.ts", "CACHE_PREFIX");

  it("reads both prefixes", () => {
    expect(nextPrefix()).toBe("vitnode:next:");
    expect(apiPrefix()).toBe("vitnode:cache:");
  });

  it("keeps neither a prefix of the other", () => {
    // The property that actually matters, stated independently of the values
    // above: `CacheModel.flush()` SCANs `vitnode:cache:*` and deletes what it
    // finds. If one namespace were ever a prefix of the other, a plugin flushing
    // its own cache would take the web application's rendered output with it -
    // or a Next revalidation would drop a plugin's domain values.
    expect(nextPrefix().startsWith(apiPrefix())).toBe(false);
    expect(apiPrefix().startsWith(nextPrefix())).toBe(false);
  });
});

describe("the tag vocabulary can outlive the Next caches", () => {
  const TAG_MODULES = INVENTORY.find(
    entry => entry.id === "framework-free-tag-strings",
  )?.files;

  it("has the tag modules on the inventory", () => {
    expect(TAG_MODULES).toEqual(["content/cache.ts", "lib/cache-tags.ts"]);
  });

  it.each(TAG_MODULES ?? [])(
    "%s imports no next/* and no server-only",
    file => {
      // This is what lets the API build the same tag list a Server Action would.
      // `content/server/revalidate-bridge.ts` runs in a plain `@hono/node-server`
      // process where importing `next/cache` throws outright, and it calls
      // `contentInvalidationTags` to decide whether there is anything to tell the
      // web app about at all.
      expect(
        importsFrom(join(sourceRoot, file)).filter(
          specifier =>
            specifier === "next" ||
            specifier.startsWith("next/") ||
            specifier === "server-only",
        ),
      ).toEqual([]);
    },
  );
});
