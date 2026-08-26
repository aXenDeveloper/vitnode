import type { ControllerRenderProps, FieldValues } from "react-hook-form";

import React from "react";

import type { ItemAutoFormComponentProps } from "@/components/form/auto-form";
import type { ContentFormFieldSpec } from "@/content/admin/spec";

import type { ContentOptionsLoader } from "./field-component";

import { ContentField } from "./field-component";

export interface ContentLeafFieldProps {
  loadOptions: ContentOptionsLoader;
  name: string;
  onChange: (value: unknown) => void;
  otherProps: ItemAutoFormComponentProps["otherProps"];
  spec: ContentFormFieldSpec;
  value: unknown;
}

export const ContentLeafField = ({
  loadOptions,
  name,
  onChange,
  otherProps,
  spec,
  value,
}: ContentLeafFieldProps) => {
  const controller = React.useMemo<ControllerRenderProps<FieldValues, string>>(
    () => ({
      disabled: false,
      name,
      onBlur: () => undefined,
      onChange: (next: unknown) => {
        const unwrapped =
          next !== null && typeof next === "object" && "target" in next
            ? (next as { target: { checked?: boolean; value?: unknown } })
                .target.value
            : next;

        onChange(unwrapped);
      },
      ref: () => undefined,
      value: value ?? "",
    }),
    [name, onChange, value],
  );

  return (
    <ContentField
      field={controller}
      loadOptions={loadOptions}
      otherProps={otherProps}
      spec={spec}
    />
  );
};
