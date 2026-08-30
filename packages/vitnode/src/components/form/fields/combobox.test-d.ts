import { describe, expectTypeOf, it } from "vitest";

import type { RawApiFetchArgs } from "@/lib/fetcher/raw";

import type { AutoFormCombobox } from "./combobox";

/**
 * Two traps closed at the type level, because a type is the only place either
 * could have been closed without a rendering test.
 *
 * ## The combobox's cache key
 *
 * `queryKey` used to be optional, with a runtime fallback of
 * `[id ?? "combobox", { search }]`. A picker whose author supplied neither prop
 * therefore cached under the bare `["combobox", { search }]` - shared with every
 * other picker in the application, unpartitioned by administrator, and *outside*
 * `["vitnode","admin"]`, which is the one prefix a sign-out removes. One
 * administrator's search results survived a sign-out and were served to the next
 * person to sign in on that tab. It is the same failure the Content Engine's
 * reference pickers had before they moved under the AdminCP root, and it is
 * worth closing the same way: by construction.
 *
 * Every real caller passed a key already. Requiring it wherever `fetchData` is
 * supplied is what stops the next one relying on the fallback.
 *
 * ## The fetcher's `options`
 *
 * `rawApiFetch` spreads `options` into the `fetch` init. `body` and `headers`
 * were omitted from its type; `method` was not, so a caller could change what
 * the call was built as. Harmless while nothing passed `options` for anything
 * but `credentials` - and worth closing the moment `signal` started travelling
 * through the same argument, because that is when callers start reaching for it.
 */

type ComboboxProps = React.ComponentProps<typeof AutoFormCombobox>;

/** What `AutoForm` hands every field component. Not the subject of these tests. */
type FieldProps = Pick<ComboboxProps, "field" | "itemParams" | "otherProps">;

declare const fieldProps: FieldProps;

describe("an async combobox must name its cache key", () => {
  it("accepts fetchData with id and queryKey", () => {
    expectTypeOf<
      FieldProps & {
        fetchData: (params: {
          search: string;
        }) => { label: string; value: string }[];
        id: string;
        queryKey: readonly unknown[];
      }
    >().toExtend<ComboboxProps>();
  });

  /**
   * The finding. Without `queryKey` the props no longer describe a legal
   * combobox, so `tsc` is what stops a picker from reaching the shared fallback.
   */
  it("rejects fetchData without a queryKey", () => {
    expectTypeOf<
      FieldProps & {
        fetchData: (params: {
          search: string;
        }) => { label: string; value: string }[];
        id: string;
      }
    >().not.toExtend<ComboboxProps>();
  });

  /**
   * `id` stays required alongside it, and the two are not interchangeable: `id`
   * identifies the control in the DOM, `queryKey` identifies the *answers*.
   */
  it("rejects fetchData without an id", () => {
    expectTypeOf<
      FieldProps & {
        fetchData: (params: {
          search: string;
        }) => { label: string; value: string }[];
        queryKey: readonly unknown[];
      }
    >().not.toExtend<ComboboxProps>();
  });

  /**
   * A synchronous combobox never fetches - its query is `enabled: false` - so it
   * needs no key, and giving it one would suggest an entry that will never hold
   * anything.
   */
  it("leaves a synchronous combobox alone", () => {
    expectTypeOf<FieldProps>().toExtend<ComboboxProps>();
    expectTypeOf(fieldProps).toExtend<ComboboxProps>();
  });
});

describe("rawApiFetch options cannot rewrite the request", () => {
  type Options = NonNullable<RawApiFetchArgs["options"]>;

  it("accepts a signal", () => {
    expectTypeOf<{ signal: AbortSignal }>().toExtend<Options>();
  });

  it("accepts credentials", () => {
    expectTypeOf<{ credentials: "include" }>().toExtend<Options>();
  });

  /** The finding: `method` is computed by the call, not supplied to it. */
  it("has no method", () => {
    expectTypeOf<Options>().not.toHaveProperty("method");
  });

  /** As `body` and `headers` already did not. */
  it("has no body and no headers", () => {
    expectTypeOf<Options>().not.toHaveProperty("body");
    expectTypeOf<Options>().not.toHaveProperty("headers");
  });
});
