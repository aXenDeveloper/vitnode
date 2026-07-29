"use client";

import type { ItemAutoFormComponentProps } from "@vitnode/core/components/form/auto-form";
import type { MultiLangValue } from "@vitnode/core/lib/helpers/multi-lang";

import { AutoFormDesc } from "@vitnode/core/components/form/common/desc";
import { AutoFormLabel } from "@vitnode/core/components/form/common/label";
import {
  MultiLangSelect,
  useMultiLangField,
} from "@vitnode/core/components/form/fields/multi-lang";
import { FormControl, FormMessage } from "@vitnode/core/components/ui/form";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@vitnode/core/components/ui/input-group";
import { upsertLangValue } from "@vitnode/core/lib/helpers/multi-lang";
import { removeSpecialCharacters } from "@vitnode/core/lib/special-characters";
import React from "react";
import { useFormContext } from "react-hook-form";

const MultiLangInputGroup = ({
  currentValue,
  languages,
  onChange,
  onBlur,
  onSelect,
  selected,
  ...props
}: Omit<
  React.ComponentProps<typeof InputGroupInput>,
  "onBlur" | "onChange" | "onSelect" | "value"
> & {
  currentValue: string;
  languages: ReturnType<typeof useMultiLangField>["languages"];
  onBlur: () => void;
  onChange: (value: string) => void;
  onSelect: (code: string) => void;
  selected: string;
}) => (
  <FormControl>
    <InputGroup>
      <InputGroupInput
        maxLength={255}
        onBlur={onBlur}
        onChange={e => onChange(e.target.value)}
        value={currentValue}
        {...props}
      />
      {languages.length > 1 && (
        <InputGroupAddon align="inline-end">
          <MultiLangSelect
            languages={languages}
            onSelect={onSelect}
            selected={selected}
          />
        </InputGroupAddon>
      )}
    </InputGroup>
  </FormControl>
);

// Title drives the friendly URL: as the user types the title for a language, the
// same language's friendly URL is filled with a slug - until that language's
// friendly URL is edited by hand (tracked in `friendlyUrlTouched`).
export const TitleField = ({
  field,
  label,
  description,
  friendlyUrlName,
  friendlyUrlTouched,
}: ItemAutoFormComponentProps & {
  friendlyUrlName: string;
  friendlyUrlTouched: React.RefObject<Set<string>>;
}) => {
  const form = useFormContext();
  const { languages, selected, setSelected, currentValue, setValue } =
    useMultiLangField(field);

  return (
    <>
      {!!label && <AutoFormLabel>{label}</AutoFormLabel>}
      <MultiLangInputGroup
        currentValue={currentValue}
        languages={languages}
        onBlur={field.onBlur}
        onChange={value => {
          setValue(value);

          if (friendlyUrlTouched.current?.has(selected)) return;
          const current: MultiLangValue | undefined =
            form.getValues(friendlyUrlName);
          form.setValue(
            friendlyUrlName,
            upsertLangValue(current, selected, removeSpecialCharacters(value)),
            { shouldValidate: true, shouldDirty: true },
          );
        }}
        onSelect={setSelected}
        selected={selected}
      />
      {!!description && <AutoFormDesc>{description}</AutoFormDesc>}
      <FormMessage />
    </>
  );
};

export const FriendlyUrlField = ({
  field,
  label,
  description,
  friendlyUrlTouched,
}: ItemAutoFormComponentProps & {
  friendlyUrlTouched: React.RefObject<Set<string>>;
}) => {
  const { languages, selected, setSelected, currentValue, setValue } =
    useMultiLangField(field);

  return (
    <>
      {!!label && <AutoFormLabel>{label}</AutoFormLabel>}
      <MultiLangInputGroup
        currentValue={currentValue}
        languages={languages}
        onBlur={field.onBlur}
        onChange={value => {
          friendlyUrlTouched.current?.add(selected);
          setValue(value);
        }}
        onSelect={setSelected}
        selected={selected}
      />
      {!!description && <AutoFormDesc>{description}</AutoFormDesc>}
      <FormMessage />
    </>
  );
};
