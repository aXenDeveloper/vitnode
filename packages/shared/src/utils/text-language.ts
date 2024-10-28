import { registerDecorator } from 'class-validator';

import { StringLanguage } from '../string-language.dto';

export const MaxLengthLanguageInput = ({ length }: { length: number }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (object: Record<string, any>, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: {
        message: `Each language must have a value with a maximum length of ${length}`,
      },
      validator: {
        validate(item: null | StringLanguage | StringLanguage[]) {
          if (!item) return true;

          return (Array.isArray(item) ? item : [item]).every(
            item => item.value.trim().length <= length,
          );
        },
      },
    });
  };
};

export const MinLengthLanguageInput = ({ length }: { length: number }) => {
  return (object: Record<string, unknown>, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: {
        message: `Each language must have a value with a minimum length of ${length}`,
      },
      validator: {
        validate(item: null | StringLanguage | StringLanguage[]) {
          if (!item) return true;

          return (Array.isArray(item) ? item : [item]).every(
            item => item.value.trim().length >= length,
          );
        },
      },
    });
  };
};

export const TransformStringLanguageInput = ({
  value,
}: {
  value: null | StringLanguage | StringLanguage[];
}) => {
  if (Array.isArray(value)) {
    let current = value.map(item => ({
      ...item,
      value: item.value.trimStart().trimEnd(),
    }));

    // If is only one item and isn't english then change to english
    if (current.find(el => el.language_code !== 'en' && current.length === 1)) {
      current = [
        {
          language_code: 'en',
          value: current[0].value,
        },
      ];
    }

    return current;
  }

  if (!value) return null;

  return {
    ...value,
    value: value.value.trimStart().trimEnd(),
  };
};

export const TransformString = ({
  value,
}: {
  value: null | string | string[];
}) => {
  if (Array.isArray(value)) {
    return value.map(item => item.trimStart().trimEnd());
  }

  return value?.trimStart().trimEnd();
};
