import React from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import type { ItemAutoFormComponentProps } from "../auto-form";

import { AutoFormDesc } from "../common/desc";
import { AutoFormLabel } from "../common/label";

type AutoFormNullableNumberProps = ItemAutoFormComponentProps &
  Omit<React.ComponentProps<typeof Input>, "value"> & {
    orLabel?: React.ReactNode;
    toggleLabel: React.ReactNode;
    unitLabel?: React.ReactNode;
  };

export const AutoFormNullableNumber = ({
  label,
  labelRight,
  description,
  field,
  otherProps: { isOptional },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  itemParams,
  // Only the language-aware inputs implement this - dropped here so it never
  // lands on the DOM element the rest props spread into.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  multiLang,
  className,
  unitLabel,
  orLabel,
  toggleLabel,
  ...props
}: AutoFormNullableNumberProps) => {
  const isToggled = field.value === null;
  const [text, setText] = React.useState(
    typeof field.value === "number" ? String(field.value) : "",
  );
  const lastNumericRef = React.useRef(
    typeof field.value === "number" ? field.value : 0,
  );

  return (
    <>
      {!!label && (
        <AutoFormLabel isOptional={isOptional} labelRight={labelRight}>
          {label}
        </AutoFormLabel>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <FormControl>
          <Input
            className={cn("w-40", className)}
            disabled={isToggled}
            onChange={event => {
              const raw = event.target.value;
              setText(raw);

              if (raw === "") {
                lastNumericRef.current = 0;
                field.onChange(0);

                return;
              }

              const parsed = Number(raw);
              if (Number.isNaN(parsed)) return;

              lastNumericRef.current = parsed;
              field.onChange(parsed);
            }}
            type="number"
            value={isToggled ? "" : text}
            {...props}
          />
        </FormControl>

        {!!unitLabel && (
          <span className="text-muted-foreground text-sm">{unitLabel}</span>
        )}
        {!!orLabel && (
          <span className="text-muted-foreground text-sm">{orLabel}</span>
        )}

        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={isToggled}
            onCheckedChange={checked => {
              if (checked) {
                field.onChange(null);

                return;
              }

              field.onChange(lastNumericRef.current);
              setText(String(lastNumericRef.current));
            }}
          />
          {toggleLabel}
        </label>
      </div>

      {!!description && <AutoFormDesc>{description}</AutoFormDesc>}
      <FormMessage />
    </>
  );
};
