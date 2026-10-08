import { z } from "zod";

import type { InputParams } from "./auto-form";

import { getNestedParam } from "./auto-form";

export interface MultiLangValueItem<TValue = string> {
  languageCode: string;
  value: TValue;
}

/** One value per language. Text by default; a rich text field holds documents. */
export type MultiLangValue<TValue = string> = MultiLangValueItem<TValue>[];

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

/** The value stored for one language, whatever its type, or `undefined`. */
export const findLangValue = <TValue>(
  value: MultiLangValue<TValue> | undefined,
  languageCode: string,
): TValue | undefined =>
  (Array.isArray(value) ? value : []).find(
    item => item.languageCode === languageCode,
  )?.value;

const hasText = (text: string): boolean => text.trim() !== "";

/**
 * The language a multi-language field opens on: the reader's own when it is
 * filled, then the default language, then the first filled one.
 */
export const pickLangCodeWhere = ({
  defaultLanguage,
  isFilledIn,
  languageCodes,
  locale,
}: {
  defaultLanguage?: null | string;
  isFilledIn: (languageCode: string) => boolean;
  languageCodes: readonly string[];
  locale: string;
}): string => {
  const current = languageCodes.includes(locale)
    ? locale
    : (languageCodes[0] ?? locale);

  return (
    [current, defaultLanguage, ...languageCodes]
      .filter(
        (code): code is string =>
          typeof code === "string" && languageCodes.includes(code),
      )
      .find(isFilledIn) ?? current
  );
};

export const pickLangCode = ({
  defaultLanguage,
  isFilled = hasText,
  languageCodes,
  locale,
  value,
}: {
  defaultLanguage?: null | string;
  isFilled?: (text: string) => boolean;
  languageCodes: readonly string[];
  locale: string;
  value: MultiLangValue | string | undefined;
}): string =>
  pickLangCodeWhere({
    defaultLanguage,
    isFilledIn: code => isFilled(getLangValue(value, code)),
    languageCodes,
    locale,
  });

export const resolveLangValue = (
  value: MultiLangValue | string | undefined,
  {
    defaultLanguage,
    locale,
  }: { defaultLanguage?: null | string; locale: string },
): string =>
  getLangValue(
    value,
    pickLangCode({
      defaultLanguage,
      languageCodes: [
        locale,
        ...(Array.isArray(value) ? value.map(item => item.languageCode) : []),
      ],
      locale,
      value,
    }),
  );

export const upsertLangValue = <TValue = string>(
  value: MultiLangValue<TValue> | undefined,
  languageCode: string,
  newValue: TValue,
): MultiLangValue<TValue> => {
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
