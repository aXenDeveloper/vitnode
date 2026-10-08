import React from "react";
import { useLocale, useTranslations } from "use-intl";

import type { FormFieldApi } from "@/components/ui/form";
import type { MultiLangValue } from "@/lib/helpers/multi-lang";
import type { LocaleConfig } from "@/vitnode.config";

import { useLanguages } from "@/components/languages-provider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  findLangValue,
  getLangValue,
  pickLangCodeWhere,
  upsertLangValue,
} from "@/lib/helpers/multi-lang";

import { useMultiLangDefaultLanguage } from "./multi-lang-default-language";
import { useMultiLangLanguage } from "./multi-lang-language";

export { multiLangValueSchema } from "@/lib/helpers/multi-lang";
export type {
  MultiLangValue,
  MultiLangValueItem,
} from "@/lib/helpers/multi-lang";

export interface MultiLangFieldProps {
  field: FormFieldApi<MultiLangValue | undefined>;
}

const useMultiLangSelection = (
  isFilledIn: (languageCode: string) => boolean,
) => {
  const languages = useLanguages();
  const locale = useLocale();
  const defaultLanguage = useMultiLangDefaultLanguage();
  const lockedLanguage = useMultiLangLanguage();
  const [selected, setSelected] = React.useState(() =>
    pickLangCodeWhere({
      defaultLanguage,
      isFilledIn,
      languageCodes: languages.map(language => language.code),
      locale,
    }),
  );

  return {
    canSelect: lockedLanguage === null && languages.length > 1,
    language: lockedLanguage ?? selected,
    languages,
    setSelected,
  };
};

const hasText = (text: string): boolean => text.trim() !== "";

export const useMultiLangField = (
  field: MultiLangFieldProps["field"],
  { isFilled = hasText }: { isFilled?: (text: string) => boolean } = {},
) => {
  const { value } = field;
  const { canSelect, language, languages, setSelected } = useMultiLangSelection(
    code => isFilled(getLangValue(value, code)),
  );

  const setValue = (newValue: string) => {
    field.onChange(upsertLangValue(value, language, newValue));
  };

  return {
    canSelect,
    languages,
    selected: language,
    setSelected,
    currentValue: getLangValue(value, language),
    setValue,
  };
};

/**
 * {@link useMultiLangField} for a value that is not text - a rich text
 * document, say. `currentValue` is `undefined` for a language with no value.
 */
export const useMultiLangValueField = <TValue,>(
  field: FormFieldApi<MultiLangValue<TValue> | undefined>,
  { isFilled }: { isFilled: (value: TValue | undefined) => boolean },
) => {
  const { value } = field;
  const { canSelect, language, languages, setSelected } = useMultiLangSelection(
    code => isFilled(findLangValue(value, code)),
  );

  const setValue = (newValue: TValue) => {
    field.onChange(upsertLangValue(value, language, newValue));
  };

  return {
    canSelect,
    languages,
    selected: language,
    setSelected,
    currentValue: findLangValue(value, language),
    setValue,
  };
};

export const MultiLangSelect = ({
  languages,
  onSelect,
  selected,
}: {
  languages: LocaleConfig[];
  onSelect: (code: string) => void;
  selected: string;
}) => {
  const t = useTranslations("core.global");

  return (
    <Select
      items={languages.map(language => ({
        value: language.code,
        label: language.name,
      }))}
      onValueChange={value => onSelect(value as string)}
      value={selected}
    >
      <SelectTrigger
        aria-label={t("select_language")}
        className="h-7 border-none bg-transparent px-2 shadow-none dark:bg-transparent"
        size="sm"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {languages.map(language => (
          <SelectItem key={language.code} value={language.code}>
            {language.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
