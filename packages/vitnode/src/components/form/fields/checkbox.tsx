import type { ItemAutoFormComponentProps } from "../auto-form";

import { Checkbox } from "../../ui/checkbox";
import { FormControl, FormItem, FormMessage } from "../../ui/form";
import { AutoFormDesc } from "../common/desc";
import { AutoFormLabel } from "../common/label";

export const AutoFormCheckbox = ({
  label,
  labelRight,
  description,
  otherProps: { isOptional },
  field,
  ...props
}: ItemAutoFormComponentProps &
  Omit<React.ComponentProps<typeof Checkbox>, "checked">) => {
  return (
    <FormItem className="flex flex-row items-start space-y-0 space-x-3 rounded-md border p-4">
      <FormControl>
        <Checkbox
          checked={field.value ?? false}
          onCheckedChange={e => {
            field.onChange(e);
            props.onCheckedChange?.(e);
          }}
          {...field}
          {...props}
        />
      </FormControl>

      {!!(label ?? description) && (
        <div className="space-y-1 leading-none">
          {label && (
            <AutoFormLabel isOptional={isOptional} labelRight={labelRight}>
              {label}
            </AutoFormLabel>
          )}
          {description && <AutoFormDesc>{description}</AutoFormDesc>}
          <FormMessage />
        </div>
      )}
    </FormItem>
  );
};
