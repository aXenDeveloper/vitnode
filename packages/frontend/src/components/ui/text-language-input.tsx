import { useMiddlewareData } from '@/hooks/use-middleware-data';
import { useLocale } from 'next-intl';
import React from 'react';
import { StringLanguage } from 'vitnode-shared/string-language.dto';

import { cn } from '../../helpers/classnames';
import { FormControl } from './form';
import { Input } from './input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';

interface Props
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'onChange' | 'value'
  > {
  className?: string;
  onChange: (value: StringLanguage[]) => void;
  value: StringLanguage[];
}

export const StringLanguageInput = ({
  className,
  onChange,
  value,
  ...props
}: Props) => {
  const locale = useLocale();
  const { languages: languagesFromGlobal } = useMiddlewareData();
  const defaultLanguage =
    languagesFromGlobal.find(item => item.default)?.code ?? 'en';
  const languages = languagesFromGlobal.filter(item => item.allow_in_input);
  const [selectedLanguage, setSelectedLanguage] = React.useState(
    locale || defaultLanguage,
  );
  const valueAsArray = Array.isArray(value) ? value : [];
  const currentValue =
    valueAsArray.find(item => item.language_code === selectedLanguage)?.value ??
    '';

  return (
    <div className={cn('flex w-full flex-col gap-2', className)}>
      <Input
        className="w-full"
        onChange={e => {
          const value = e.target.value;

          if (value.length > 0) {
            onChange([
              ...valueAsArray.filter(
                item => item.language_code !== selectedLanguage,
              ),
              {
                language_code: selectedLanguage,
                value: value,
              },
            ]);

            return;
          }

          onChange(
            valueAsArray.filter(
              item => item.language_code !== selectedLanguage,
            ),
          );
        }}
        type="text"
        value={currentValue}
        {...props}
      />

      {languages.length > 1 && (
        <Select onValueChange={setSelectedLanguage} value={selectedLanguage}>
          <FormControl>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            {languages.map(language => (
              <SelectItem key={language.code} value={language.code}>
                {language.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
};
