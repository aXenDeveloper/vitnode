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
  hasText,
  pickLangCodeWhere,
  upsertLangValue,
} from "@/lib/helpers/multi-lang";

import { AutoFormLabel } from "../common/label";
import { useMultiLangDefaultLanguage } from "./multi-lang-default-language";
import {
  MultiLangSelectedContext,
  useMultiLangLanguage,
} from "./multi-lang-language";
import {
  MultiLangPresenceContext,
  MultiLangShownLanguageContext,
} from "./multi-lang-presence";

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

  const language = lockedLanguage ?? selected;
  const reportShown = React.use(MultiLangShownLanguageContext);
  React.useEffect(() => {
    reportShown?.(language);
  }, [language, reportShown]);

  return {
    canSelect: lockedLanguage === null && languages.length > 1,
    language,
    languages,
    setSelected,
  };
};

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
  const presence = React.use(MultiLangPresenceContext);
  const elsewhere =
    presence !== null &&
    languages.some(
      language => language.code !== selected && presence.busy(language.code),
    );

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
        {elsewhere ? (
          <span aria-hidden className="bg-primary size-1.5 rounded-full" />
        ) : null}
      </SelectTrigger>
      <SelectContent align="end">
        {languages.map(language => (
          <SelectItem key={language.code} value={language.code}>
            {language.name}
            {presence?.marker(language.code)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export const MultiLangLabel = ({
  canSelect,
  isOptional,
  label,
  labelRight,
  languages,
  onSelect,
  selected,
}: React.ComponentProps<typeof MultiLangSelect> & {
  canSelect: boolean;
  isOptional?: boolean;
  label?: React.ReactNode;
  labelRight?: React.ReactNode;
}) => {
  if (!label && !canSelect) return null;

  return (
    <div className="flex items-center gap-2">
      {!!label && (
        <AutoFormLabel
          className="flex-1"
          isOptional={isOptional}
          labelRight={
            labelRight ? (
              <MultiLangSelectedContext value={selected}>
                {labelRight}
              </MultiLangSelectedContext>
            ) : undefined
          }
        >
          {label}
        </AutoFormLabel>
      )}
      {canSelect && (
        <div className="-my-1.5 ms-auto shrink-0">
          <MultiLangSelect
            languages={languages}
            onSelect={onSelect}
            selected={selected}
          />
        </div>
      )}
    </div>
  );
};
