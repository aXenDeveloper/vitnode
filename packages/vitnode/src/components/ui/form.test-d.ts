import { describe, expectTypeOf, it } from "vitest";

import type { ItemAutoFormComponentProps } from "../form/auto-form";
import type { AnyFormFieldApi, FormFieldApi } from "./form";

type ChangeOf<TValue> = Parameters<FormFieldApi<TValue>["onChange"]>[0];

type TypedControlProps = Omit<ItemAutoFormComponentProps, "field"> & {
  field: FormFieldApi<string | undefined>;
};

describe("a control that names its value type", () => {
  it("reads the value it declared", () => {
    expectTypeOf<FormFieldApi<string>["value"]>().toEqualTypeOf<string>();
  });

  it("refuses a change of another shape", () => {
    expectTypeOf<number>().not.toExtend<ChangeOf<string>>();
  });

  it("still takes the DOM event the adapter unwraps", () => {
    expectTypeOf<React.ChangeEvent<HTMLInputElement>>().toExtend<
      ChangeOf<string>
    >();
    expectTypeOf<React.ChangeEvent<HTMLTextAreaElement>>().toExtend<
      ChangeOf<string>
    >();
  });

  it("is what AutoForm can hand a component it picked at runtime", () => {
    expectTypeOf<ItemAutoFormComponentProps>().toExtend<TypedControlProps>();
    expectTypeOf<FormFieldApi>().toExtend<AnyFormFieldApi>();
  });
});
