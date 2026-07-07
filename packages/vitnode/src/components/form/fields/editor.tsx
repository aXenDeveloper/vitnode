import type React from "react";

import { Editor } from "@/components/ui/editor";
import { FormControl, FormMessage } from "@/components/ui/form";

import type { ItemAutoFormComponentProps } from "../auto-form";

import { AutoFormDesc } from "../common/desc";
import { AutoFormLabel } from "../common/label";

export const AutoFormEditor = ({
  label,
  labelRight,
  description,
  otherProps: { isOptional },
  field,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  itemParams,
  ...props
}: ItemAutoFormComponentProps &
  Omit<React.ComponentProps<typeof Editor>, "onChange" | "value">) => {
  return (
    <>
      {label && (
        <AutoFormLabel isOptional={isOptional} labelRight={labelRight}>
          {label}
        </AutoFormLabel>
      )}

      <FormControl>
        <Editor
          onBlur={field.onBlur}
          onChange={field.onChange}
          value={field.value ?? ""}
          {...props}
        />
      </FormControl>

      {description && <AutoFormDesc>{description}</AutoFormDesc>}
      <FormMessage />
    </>
  );
};
