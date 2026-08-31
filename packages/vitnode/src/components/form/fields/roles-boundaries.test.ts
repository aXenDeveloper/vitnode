// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { reachedSpecifiers, runtimeImports } from "@/tests/import-graph";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * The role field's injected search, which took two attempts to remove.
 *
 * `search` used to default to a server action carrying the `server-only` marker.
 * A static import put that marker in the graph of every application rendering
 * the field, and deferring it behind `await import()` only moved the throw from
 * load time to the first keystroke. The fix was to move the type into a module
 * with no imports and make the search a required, injected prop - so the field
 * does not know how roles are found.
 *
 * That is what this file asserts, and it has to read the source to do it: a type
 * test cannot see a default parameter, and a render test passes either way. The
 * host-neutrality half of the old claim - reaches nothing from `next/*`, from the
 * `server-only` marker, from `next-intl` - is now `next-boundary.test.ts`'s, over
 * every file in the package.
 */
const SHARED = {
  /** The framework-neutral field. */
  field: join(here, "input-roles.tsx"),
  /** The type and the search signature, with no imports at all. */
  types: join(here, "roles.ts"),
};

const read = (path: string) => readFileSync(path, "utf8");

describe("the role field's dependencies point outward", () => {
  it("takes its translations from use-intl", () => {
    expect(reachedSpecifiers(SHARED.field)).toContain("use-intl");
  });

  it("declares its role types in a module that imports nothing", () => {
    expect(runtimeImports(SHARED.types)).toEqual([]);
  });

  it("reads RoleOption from that module rather than from a transport", () => {
    const source = read(SHARED.field);

    expect(source).toMatch(
      /import type \{ RoleOption, RoleSearch \} from "\.\/roles"/,
    );
    expect(source).not.toContain("search-roles");
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

  it("is not rescued by a default when a caller forgets it", () => {
    // The specific regression: with nothing left to supply a default, the
    // tempting fix for a caller that forgot `search` is one here. That would put
    // a transport back inside a framework-neutral component and re-close the
    // seam.
    expect(read(SHARED.field)).not.toMatch(/search\s*=\s*search[A-Z]/);
  });

  it("still exports the canonical field and its two types", () => {
    // The three names a host binds to.
    expect(read(SHARED.field)).toContain("export const AutoFormRoles");
    expect(read(SHARED.types)).toContain("export interface RoleOption");
    expect(read(SHARED.types)).toContain("export type RoleSearch");
  });

  it("leaves a browser search for the host to pass, in the AdminCP's own module", () => {
    // `searchAdminRolesInBrowser` is the answer for every host now, and it lives
    // with the roles screen's other reads rather than beside the field - which is
    // the point.
    const rolesQuery = join(
      here,
      "../../../views/admin/views/core/users/roles/roles-query.ts",
    );

    expect(read(rolesQuery)).toContain(
      "export const searchAdminRolesInBrowser",
    );
  });
});
