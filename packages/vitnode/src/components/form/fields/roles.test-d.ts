import { describe, expectTypeOf, it } from "vitest";

import type { AutoFormRolesProps } from "./input-roles";
import type { RoleOption, RoleSearch } from "./roles";

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
