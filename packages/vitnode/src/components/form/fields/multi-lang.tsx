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
  getLangValue,
  pickLangCode,
  upsertLangValue,
} from "@/lib/helpers/multi-lang";

import { useMultiLangDefaultLanguage } from "./multi-lang-default-language";

export { multiLangValueSchema } from "@/lib/helpers/multi-lang";
export type {
  MultiLangValue,
  MultiLangValueItem,
} from "@/lib/helpers/multi-lang";

export interface MultiLangFieldProps {
  field: FormFieldApi<MultiLangValue | undefined>;
}

export const useMultiLangField = (
  field: MultiLangFieldProps["field"],
  { isFilled }: { isFilled?: (text: string) => boolean } = {},
) => {
  const languages = useLanguages();
  const locale = useLocale();
  const defaultLanguage = useMultiLangDefaultLanguage();
  const { value } = field;
  const [selected, setSelected] = React.useState(() =>
    pickLangCode({
      defaultLanguage,
      isFilled,
      languageCodes: languages.map(language => language.code),
      locale,
      value,
    }),
  );

  const setValue = (newValue: string) => {
    field.onChange(upsertLangValue(value, selected, newValue));
  };

  return {
    languages,
    selected,
    setSelected,
    currentValue: getLangValue(value, selected),
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
