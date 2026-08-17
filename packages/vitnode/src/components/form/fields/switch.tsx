import { FormControl } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import type { ItemAutoFormComponentProps } from "../auto-form";

import { AutoFormDesc } from "../common/desc";
import { AutoFormLabel } from "../common/label";

export const AutoFormSwitch = ({
  label,
  field,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  itemParams,
  // Only the language-aware inputs implement this - dropped here so it never
  // lands on the DOM element the rest props spread into.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  multiLang,
  labelRight,
  otherProps: { isOptional },
  className,
  description,
  ...props
}: ItemAutoFormComponentProps &
  Omit<React.ComponentProps<typeof Switch>, "checked">) => {
  return (
    <div
      className={cn(
        "flex flex-row items-center justify-between rounded-lg border p-4",
        className,
      )}
    >
      {!!(label ?? description) && (
        <div className="space-y-0.5">
          {!!label && (
            <AutoFormLabel
              className="text-base"
              isOptional={isOptional}
              labelRight={labelRight}
            >
              {label}
            </AutoFormLabel>
          )}
          {!!description && <AutoFormDesc>{description}</AutoFormDesc>}
        </div>
      )}

      <FormControl>
        <Switch
          checked={field.value ?? false}
          onCheckedChange={(checked, eventDetails) => {
            field.onChange(checked);
            props?.onCheckedChange?.(checked, eventDetails);
          }}
          {...props}
        />
      </FormControl>
    </div>
  );
};
