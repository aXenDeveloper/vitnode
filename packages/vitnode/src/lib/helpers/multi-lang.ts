import { z } from "zod";

import type { InputParams } from "./auto-form";

import { getNestedParam } from "./auto-form";

export interface MultiLangValueItem {
  languageCode: string;
  value: string;
}

export type MultiLangValue = MultiLangValueItem[];

export const multiLangValueSchema = ({
  maxLength,
  minLength,
}: {
  maxLength?: number;
  minLength?: number;
} = {}) => {
  let value = z.string();
  if (minLength !== undefined) {
    value = value.min(minLength);
  }
  if (maxLength !== undefined) {
    value = value.max(maxLength);
  }

  return z.array(
    z.object({
      languageCode: z.string(),
      value,
    }),
  );
};

export const getLangValue = (
  value: MultiLangValue | string | undefined,
  languageCode: string,
): string => {
  if (typeof value === "string") {
    return value;
  }

  return (
    (Array.isArray(value) ? value : []).find(
      item => item.languageCode === languageCode,
    )?.value ?? ""
  );
};

export const upsertLangValue = (
  value: MultiLangValue | undefined,
  languageCode: string,
  newValue: string,
): MultiLangValue => {
  const current = Array.isArray(value) ? value : [];

  if (current.some(item => item.languageCode === languageCode)) {
    return current.map(item =>
      item.languageCode === languageCode ? { ...item, value: newValue } : item,
    );
  }

  return [...current, { languageCode, value: newValue }];
};

// The `value` constraints (min/max length) of a `multiLang` field live on the
// array item, so they arrive as `itemParams.value` rather than top-level
// `otherProps`. Pull them back out for the per-language input.
export const getMultiLangConstraints = (
  itemParams?: InputParams,
): { maxLength?: number; minLength?: number } => {
  const valueParams = itemParams
    ? getNestedParam(itemParams, "value")
    : undefined;

  if (!valueParams || typeof valueParams !== "object") {
    return {};
  }

  return {
    maxLength:
      "maxLength" in valueParams && typeof valueParams.maxLength === "number"
        ? valueParams.maxLength
        : undefined,
    minLength:
      "minLength" in valueParams && typeof valueParams.minLength === "number"
        ? valueParams.minLength
        : undefined,
  };
};
