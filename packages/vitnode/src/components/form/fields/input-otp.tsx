import React from "react";

import type { ItemAutoFormComponentProps } from "../auto-form";

import { FormControl, FormMessage } from "../../ui/form";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "../../ui/input-otp";
import { AutoFormDesc } from "../common/desc";
import { AutoFormLabel } from "../common/label";

const DEFAULT_CODE_LENGTH = 6;

const splitIntoHalves = (length: number) =>
  length >= 6 && length % 2 === 0 ? [length / 2, length / 2] : [length];

type AutoFormInputOTPProps = ItemAutoFormComponentProps &
  Omit<
    React.ComponentProps<typeof InputOTP>,
    "children" | "maxLength" | "onChange" | "render" | "value"
  > & {
    groups?: number[];
    maxLength?: number;
    onChange?: (value: string) => void;
  };

export const AutoFormInputOTP = ({
  label,
  labelRight,
  description,
  otherProps,
  field,
  groups,
  maxLength,
  pattern,
  onChange,
  // oxlint-disable-next-line no-unused-vars
  itemParams,
  // oxlint-disable-next-line no-unused-vars
  multiLang,
  // oxlint-disable-next-line no-unused-vars
  children,
  ...props
}: AutoFormInputOTPProps) => {
  const length = maxLength ?? otherProps.maxLength ?? DEFAULT_CODE_LENGTH;
  const slotGroups = groups ?? splitIntoHalves(length);
  const groupStarts = slotGroups.map((_, groupIndex) =>
    slotGroups.slice(0, groupIndex).reduce((sum, size) => sum + size, 0),
  );

  return (
    <>
      {!!label && (
        <AutoFormLabel
          isOptional={otherProps.isOptional}
          labelRight={labelRight}
        >
          {label}
        </AutoFormLabel>
      )}

      <FormControl>
        <InputOTP
          maxLength={length}
          name={field.name}
          onBlur={field.onBlur}
          onChange={value => {
            field.onChange(value);
            onChange?.(value);
          }}
          pattern={pattern ?? otherProps.pattern}
          value={field.value ?? ""}
          {...props}
        >
          {slotGroups.map((size, groupIndex) => (
            <React.Fragment key={groupStarts[groupIndex]}>
              {groupIndex > 0 && <InputOTPSeparator />}
              <InputOTPGroup>
                {Array.from({ length: size }, (_, slot) => {
                  const index = groupStarts[groupIndex] + slot;

                  return <InputOTPSlot index={index} key={index} />;
                })}
              </InputOTPGroup>
            </React.Fragment>
          ))}
        </InputOTP>
      </FormControl>

      {!!description && <AutoFormDesc>{description}</AutoFormDesc>}
      <FormMessage />
    </>
  );
};
