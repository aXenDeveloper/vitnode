import { cn } from "cn";

import { FormControl } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";

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
        "flex flex-row items-center gap-4 rounded-lg border p-4",
        className,
      )}
    >
      <FormControl>
        <Switch
          checked={field.value ?? false}
          className="shrink-0"
          onCheckedChange={(checked, eventDetails) => {
            field.onChange(checked);
            props?.onCheckedChange?.(checked, eventDetails);
          }}
          {...props}
        />
      </FormControl>

      {!!(label ?? description) && (
        <div className="flex flex-1 flex-col gap-0.5">
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
    </div>
  );
};
