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
    // Optional connector text between the unit and the checkbox, e.g. "or".
    orLabel?: React.ReactNode;
    // Label for the checkbox. Checking it sets the value to `null` and disables
    // the input (e.g. "Unlimited", "Never", "No limit").
    toggleLabel: React.ReactNode;
    // Optional unit shown right after the input, e.g. "kB", "minutes", "%".
    unitLabel?: React.ReactNode;
  };

/**
 * A numeric field paired with a checkbox that toggles the value to `null`.
 *
 * The form value is `number | null`:
 * - a `number` - the value typed in the input, or
 * - `null` - when the checkbox is checked (the input is disabled).
 *
 * Use it wherever a number can also mean "no value": an unlimited storage cap,
 * a session that never expires, an uncapped rate limit, and so on. Back it with
 * a `z.number().nullable()` schema (keep it optional/defaulted when the field
 * can be hidden). Extra props (`min`, `max`, `step`, `placeholder`, …) are
 * forwarded to the underlying input, and validation constraints come from the
 * Zod schema.
 *
 * @example
 * ```tsx
 * const formSchema = z.object({
 *   maxMembers: z.number().int().min(1).nullable().default(null),
 * });
 *
 * <AutoFormNullableNumber {...props} label="Maximum members" toggleLabel="Unlimited" />
 * ```
 */
export const AutoFormNullableNumber = ({
  label,
  labelRight,
  description,
  field,
  otherProps: { isOptional },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  itemParams,
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
  // Remember the last numeric value so unchecking the toggle restores it.
  const lastNumericRef = React.useRef(
    typeof field.value === "number" ? field.value : 0,
  );

  return (
    <>
      {label && (
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

        {unitLabel && (
          <span className="text-muted-foreground text-sm">{unitLabel}</span>
        )}
        {orLabel && (
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

      {description && <AutoFormDesc>{description}</AutoFormDesc>}
      <FormMessage />
    </>
  );
};
