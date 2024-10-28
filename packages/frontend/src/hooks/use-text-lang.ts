import { removeSpecialCharacters } from '@/helpers/special-characters';
import { useLocale } from 'next-intl';
import { getLocale } from 'next-intl/server';
import { StringLanguage } from 'vitnode-shared/string-language.dto';

const getConvertTextLang = ({
  locale,
  text,
}: {
  locale: string;
  text?: StringLanguage[];
}): string => {
  if (!text || text.length === 0) {
    return '';
  }

  if (text.length <= 1) {
    return text[0].value;
  }

  const textFromLang = text.find(t => t.language_code === locale);

  if (textFromLang) {
    return textFromLang.value;
  }

  return text[0].value;
};

export const getConvertNameToLink = ({
  id,
  locale,
  name,
}: {
  id: number;
  locale: string;
  name: StringLanguage[];
}) => {
  const text = removeSpecialCharacters(
    getConvertTextLang({ locale, text: name }),
  ).toLowerCase();

  return `${text}-${id}`;
};

export const useTextLang = () => {
  const locale = useLocale();

  return {
    convertText: (text?: StringLanguage[]) =>
      getConvertTextLang({ locale, text }),
    convertNameToLink: ({ id, name }: { id: number; name: StringLanguage[] }) =>
      getConvertNameToLink({ id, name, locale }),
  };
};

export const getTextLang = async () => {
  const locale = await getLocale();

  return {
    convertText: (text?: StringLanguage[]) =>
      getConvertTextLang({ locale, text }),
    convertNameToLink: ({ id, name }: { id: number; name: StringLanguage[] }) =>
      getConvertNameToLink({ id, name, locale }),
  };
};
