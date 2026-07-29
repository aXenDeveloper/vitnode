import { cn } from "@/lib/utils";

import type { ItemAutoFormComponentProps } from "../auto-form";

import { Checkbox } from "../../ui/checkbox";
import { FormControl, FormMessage } from "../../ui/form";
import { AutoFormDesc } from "../common/desc";
import { AutoFormLabel } from "../common/label";

export const AutoFormCheckbox = ({
  label,
  labelRight,
  description,
  otherProps: { isOptional },
  field,
  className,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  itemParams,
  ...props
}: ItemAutoFormComponentProps &
  Omit<React.ComponentProps<typeof Checkbox>, "checked">) => {
  return (
    <div
      className={cn(
        "flex flex-row items-start space-y-0 space-x-3 rounded-md border p-4",
        className,
      )}
    >
      <FormControl>
        <Checkbox
          checked={field.value ?? false}
          onCheckedChange={(checked, eventDetails) => {
            field.onChange(checked);
            props.onCheckedChange?.(checked, eventDetails);
          }}
          {...field}
          {...props}
        />
      </FormControl>

      {!!(label ?? description) && (
        <div className="space-y-1 leading-none">
          {!!label && (
            <AutoFormLabel isOptional={isOptional} labelRight={labelRight}>
              {label}
            </AutoFormLabel>
          )}
          {!!description && <AutoFormDesc>{description}</AutoFormDesc>}
          <FormMessage />
        </div>
      )}
    </div>
  );
};
