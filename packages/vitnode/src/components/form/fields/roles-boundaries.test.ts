// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  NEXT_INTL,
  NEXT_ONLY,
  offenders,
  reachedSpecifiers,
  runtimeImports,
} from "@/tests/import-graph";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * The role field, and the two couplings it took two attempts to remove.
 *
 * Neither looked like one, which is why this is a scan rather than a review:
 *
 * - `useLocale`/`useTranslations` came from `next-intl`, whose root entry
 *   re-exports `use-intl`. It *worked*, which is why it survived so long - what
 *   it cost was the boundary, not a render.
 * - `search` defaulted to `searchRoles`, a `"use server"` action carrying
 *   `server-only`. A static import put that marker in the graph of every
 *   application rendering the field, and deferring it behind `await import()`
 *   only moved the throw from load time to the first keystroke.
 *
 * The fix was to move the type into a module with no imports and make the search
 * a required, injected prop. Stage 17 then deleted the Next.js adapter that
 * supplied the default, so what this file used to prove about that adapter -
 * that it was the one place allowed to name the action - is now proved by the
 * adapter's absence.
 *
 * The scanner and its positive controls live in `@/tests/import-graph` and
 * `src/next-boundary.test.ts`.
 */
const SHARED = {
  /** The framework-neutral field. */
  field: join(here, "input-roles.tsx"),
  /** The type and the search signature, with no imports at all. */
  types: join(here, "roles.ts"),
};

/**
 * The Next.js half, by path, so its absence can be asserted.
 *
 * Kept as named constants rather than deleted with the assertion: the risk this
 * guards is somebody reintroducing the convenience, and a test that no longer
 * names the file cannot notice that happening.
 */
const DELETED_NEXT_HALF = {
  action: join(here, "search-roles.action.server.ts"),
  adapter: join(here, "input-roles-next.tsx"),
};

const read = (path: string) => readFileSync(path, "utf8");

describe("the shared role field is framework-neutral", () => {
  it("reaches nothing from next/* or the server-only marker", () => {
    expect(offenders(SHARED.field, NEXT_ONLY)).toEqual([]);
  });

  it("never imports next-intl, root entry included", () => {
    // The one that worked, and was therefore the one that lasted.
    expect(offenders(SHARED.field, NEXT_INTL)).toEqual([]);
  });

  it("takes its translations from use-intl", () => {
    expect(reachedSpecifiers(SHARED.field)).toContain("use-intl");
  });

  it("declares its role types in a module that imports nothing", () => {
    expect(runtimeImports(SHARED.types)).toEqual([]);
  });

  it("reads RoleOption from that module rather than from an action", () => {
    const source = read(SHARED.field);

    expect(source).toMatch(
      /import type \{ RoleOption, RoleSearch \} from "\.\/roles"/,
    );
    expect(source).not.toContain("search-roles.action.server");
  });
});

/**
 * The contract itself, read off the source.
 *
 * A type test would be the stronger form and cannot be written here: `search`
 * being required is a property of a `.tsx` component's props, and this suite is
 * a static scan. What is asserted instead is the two things that made it
 * optional - a default parameter and a fallback - staying absent.
 */
describe("the search dependency is injected, and stays injected", () => {
  it("is required on the props type", () => {
    expect(read(SHARED.field)).toMatch(/\n {2}search: RoleSearch;/);
  });

  it("has no default parameter", () => {
    // The destructured parameter, at its own indent - `search={...}` further
    // down is the prop handed to `AsyncPicker` and is not what this is about.
    const source = read(SHARED.field);

    expect(source).toMatch(/\n {2}search,\n/);
    expect(source).not.toMatch(/\n {2}search\s*=/);
  });

  it("has no fallback and no host detection", () => {
    const source = read(SHARED.field);

    expect(source).not.toContain("searchRolesLazily");
    expect(source).not.toMatch(/typeof window|process\.env|import\.meta\.env/);
  });

  it("still exports the canonical field and its two types", () => {
    // The three names a host binds to. Deleting the adapter must not have taken
    // any of them with it.
    expect(read(SHARED.field)).toContain("export const AutoFormRoles");
    expect(read(SHARED.types)).toContain("export interface RoleOption");
    expect(read(SHARED.types)).toContain("export type RoleSearch");
  });

  it("leaves a browser search for the host to pass, in the AdminCP's own module", () => {
    // `searchAdminRolesInBrowser` is the answer for every host now, and it lives
    // with the roles screen's other reads rather than beside the field - which is
    // the point: the field does not know how roles are found.
    const rolesQuery = join(
      here,
      "../../../views/admin/views/core/users/roles/roles-query.ts",
    );

    expect(read(rolesQuery)).toContain(
      "export const searchAdminRolesInBrowser",
    );
  });
});

describe("the Next.js half is gone, and a default search may not return", () => {
  it.each(Object.entries(DELETED_NEXT_HALF))(
    "%s no longer exists",
    (_name, path) => {
      expect(existsSync(path)).toBe(false);
    },
  );

  it("is not replaced by a default inside the field", () => {
    // The specific regression: with no adapter left, the tempting fix for a
    // caller that forgot `search` is a default here. That would put a transport
    // back inside a framework-neutral component and re-close the seam.
    const source = read(SHARED.field);

    expect(source).not.toMatch(/search\s*=\s*search[A-Z]/);
    expect(source).not.toContain("AutoFormRolesNext");
  });
});
