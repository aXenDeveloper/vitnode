import type { ControllerRenderProps, FieldValues } from "react-hook-form";

import React from "react";

import type { ItemAutoFormComponentProps } from "@/components/form/auto-form";
import type { ContentFormFieldSpec } from "@/content/admin/spec";

import type { ContentOptionsLoader } from "./field-component";

import { ContentField } from "./field-component";

export interface ContentLeafFieldProps {
  loadOptions: ContentOptionsLoader;
  /** The dotted react-hook-form path, for `id` and label association. */
  name: string;
  onChange: (value: unknown) => void;
  otherProps: ItemAutoFormComponentProps["otherProps"];
  spec: ContentFormFieldSpec;
  value: unknown;
}

/**
 * One leaf of a group or a repeatable row, rendered by the ordinary field
 * component.
 *
 * The adapter is the whole point: `ContentField` expects react-hook-form's
 * `ControllerRenderProps`, and a leaf is not registered with react-hook-form at
 * all - its parent is. Handing it a synthetic controller keeps every leaf input
 * identical to the one a top-level field of the same kind renders, which is
 * what stops Stage 6 from growing a second form system.
 */
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
        // Both shapes an input can hand back: a DOM event, or the value itself.
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
      otherProps={{ ...otherProps, isOptional: !spec.required }}
      spec={spec}
    />
  );
};
