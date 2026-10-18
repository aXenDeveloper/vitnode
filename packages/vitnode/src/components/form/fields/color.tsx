import type React from "react";

import { ColorPicker } from "@/components/ui/color-picker";
import { FormControl, FormMessage } from "@/components/ui/form";

import type { ItemAutoFormComponentProps } from "../auto-form";

import { AutoFormDesc } from "../common/desc";
import { AutoFormLabel } from "../common/label";

/**
 * A color picker for an `AutoForm` string field. Stores a CSS color string -
 * the picker writes `hsl(...)`, presets write their own value, and the text
 * box accepts anything typed. Spread the props `AutoForm` passes and add a
 * `label`.
 */
export const AutoFormColor = ({
  label,
  labelRight,
  description,
  tip,
  otherProps: { isOptional },
  field,
  // oxlint-disable-next-line no-unused-vars
  itemParams,
  // Only the language-aware inputs implement this - dropped here so it never
  // lands on the DOM element the rest props spread into.
  // oxlint-disable-next-line no-unused-vars
  multiLang,
  ...props
}: ItemAutoFormComponentProps &
  Omit<React.ComponentProps<typeof ColorPicker>, "onChange" | "value">) => {
  return (
    <>
      {!!label && (
        <AutoFormLabel
          isOptional={isOptional}
          labelRight={labelRight}
          tip={tip}
        >
          {label}
        </AutoFormLabel>
      )}

      <FormControl>
        <ColorPicker
          onBlur={field.onBlur}
          onChange={field.onChange}
          value={field.value ?? ""}
          {...props}
        />
      </FormControl>

      {!!description && <AutoFormDesc>{description}</AutoFormDesc>}
      <FormMessage />
    </>
  );
};
