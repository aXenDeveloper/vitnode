import { describe, expectTypeOf, it } from "vitest";

import type { RawApiFetchArgs } from "@/lib/fetcher/raw";

import type { AutoFormCombobox } from "./combobox";

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
