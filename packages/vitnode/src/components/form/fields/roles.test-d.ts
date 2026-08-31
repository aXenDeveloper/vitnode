import { describe, expectTypeOf, it } from "vitest";

import type { AutoFormRolesProps } from "./input-roles";
import type { RoleOption, RoleSearch } from "./roles";

/**
 * The role field's contract, at the type level.
 *
 * `roles-boundaries.test.ts` reads the source and proves the *graph* is
 * framework-neutral - no `next-intl`, no `"use server"` action, statically or
 * dynamically. This proves the other half, which a source scan cannot: that the
 * search dependency is genuinely part of the props rather than something with a
 * default hiding behind it.
 *
 * A required prop is the whole design. `search` used to default to a Next.js
 * server action, so `<AutoFormRoles {...props} />` compiled everywhere and threw
 * on any host but one. Required, the compiler asks the question at the call
 * site, which is the only place that knows the answer.
 */
describe("AutoFormRolesProps", () => {
  it("requires a search implementation", () => {
    expectTypeOf<AutoFormRolesProps>().toHaveProperty("search");
    // Not `search?:`. `Partial` would satisfy `toHaveProperty` either way, so
    // the absence of `undefined` from the member's type is what is asserted.
    expectTypeOf<AutoFormRolesProps["search"]>().not.toEqualTypeOf<
      RoleSearch | undefined
    >();
    expectTypeOf<AutoFormRolesProps["search"]>().toEqualTypeOf<RoleSearch>();
  });

  it("takes a search that answers with framework-neutral roles", () => {
    expectTypeOf<RoleSearch>().toEqualTypeOf<
      (search: string) => Promise<RoleOption[]>
    >();
  });

  it("describes a role by its id, colour and per-language names", () => {
    expectTypeOf<RoleOption>().toEqualTypeOf<{
      color: null | string;
      id: number;
      name: { languageCode: string; name: string }[];
    }>();
  });

  /**
   * The AdminCP's own browser search is assignable as-is.
   *
   * That is the point of the shape being identical to `AdminRoleOption`: a
   * TanStack host hands the field `searchAdminRolesInBrowser` - a plain fetch to
   * Hono - and nothing has to adapt between them.
   */
  it("accepts a browser search over the Hono roles endpoint", () => {
    const searchInBrowser = async (
      search: string,
    ): Promise<
      {
        color: null | string;
        id: number;
        name: { languageCode: string; name: string }[];
      }[]
    > => {
      void search;

      return await Promise.resolve([]);
    };

    expectTypeOf(searchInBrowser).toExtend<RoleSearch>();
  });
});
