import { describe, expectTypeOf, it } from "vitest";

import type { AutoFormCombobox } from "./combobox";

type ComboboxProps = React.ComponentProps<typeof AutoFormCombobox>;
type FieldProps = Pick<ComboboxProps, "field" | "itemParams" | "otherProps">;
type FetchData = (params: {
  search: string;
}) => { label: string; value: string }[];

describe("an async combobox must name its cache key", () => {
  it("accepts fetchData with an id and a queryKey, and a synchronous combobox", () => {
    expectTypeOf<
      FieldProps & {
        fetchData: FetchData;
        id: string;
        queryKey: readonly unknown[];
      }
    >().toExtend<ComboboxProps>();
    expectTypeOf<FieldProps>().toExtend<ComboboxProps>();
  });

  it("rejects fetchData without a queryKey or without an id", () => {
    expectTypeOf<
      FieldProps & { fetchData: FetchData; id: string }
    >().not.toExtend<ComboboxProps>();
    expectTypeOf<
      FieldProps & { fetchData: FetchData; queryKey: readonly unknown[] }
    >().not.toExtend<ComboboxProps>();
  });
});
