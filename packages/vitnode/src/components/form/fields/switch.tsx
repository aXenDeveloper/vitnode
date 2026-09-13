import { cn } from "cn";
import { useId } from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
} from "@/components/ui/accordion";
import { FormControl } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";

import type { ItemAutoFormComponentProps } from "../auto-form";

import { AutoFormDesc } from "../common/desc";
import { AutoFormLabel } from "../common/label";

const FIELDS_PANEL = "fields";

export const AutoFormSwitch = ({
  label,
  field,
  children,
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
  const id = useId();
  const panelId = `${id}-fields`;
  const labelId = `${id}-label`;
  const isChecked: boolean = field.value ?? false;

  return (
    <div className={cn("rounded-lg border", className)}>
      <div className="flex flex-row items-center gap-4 p-4">
        <FormControl>
          <Switch
            aria-controls={children ? panelId : undefined}
            aria-expanded={children ? isChecked : undefined}
            checked={isChecked}
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
                id={labelId}
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

      {!!children && (
        <Accordion value={isChecked ? [FIELDS_PANEL] : []}>
          <AccordionItem value={FIELDS_PANEL}>
            <AccordionContent
              aria-labelledby={label ? labelId : undefined}
              className="flex flex-col gap-6 border-t p-4 text-base"
              id={panelId}
              role={label ? "region" : "group"}
            >
              {children}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
};
