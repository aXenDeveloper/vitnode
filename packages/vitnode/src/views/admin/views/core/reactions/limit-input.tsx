import { REACTIONS_LIMITS } from "@vitnode/api/lib/reactions/const";
import React from "react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@/components/ui/number-field";

/**
 * A daily limit with an "Unlimited" checkbox that stores `null`, for rows of
 * a table where a full `AutoFormNullableNumber` does not fit. Laid out like
 * it: the input, its unit, "or", then the checkbox.
 */
export const LimitInput = ({
  disabled,
  label,
  onChange,
  orLabel,
  unitLabel,
  unlimitedLabel,
  value,
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: null | number) => void;
  orLabel: string;
  unitLabel: string;
  unlimitedLabel: string;
  value: null | number;
}) => {
  const lastRef = React.useRef(value ?? 10);
  const unlimited = value === null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <NumberField
        aria-label={label}
        className="w-32"
        disabled={(disabled ?? false) || unlimited}
        max={REACTIONS_LIMITS.maxDailyLimit}
        min={1}
        onValueChange={next => {
          const number = next ?? 1;
          lastRef.current = number;
          onChange(number);
        }}
        value={value}
      >
        <NumberFieldGroup>
          <NumberFieldDecrement />
          <NumberFieldInput />
          <NumberFieldIncrement />
        </NumberFieldGroup>
      </NumberField>
      <span className="text-muted-foreground text-sm">{unitLabel}</span>
      <span className="text-muted-foreground text-sm">{orLabel}</span>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={unlimited}
          disabled={disabled}
          onCheckedChange={checked => {
            onChange(checked ? null : lastRef.current);
          }}
        />
        {unlimitedLabel}
      </label>
    </div>
  );
};
