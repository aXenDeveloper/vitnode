import { AutoFormComponentProps } from '@/components/form/auto-form';
import { AutoFormStringLanguageInput } from '@/components/form/fields/text-language-input';
import { Badge } from '@/components/ui/badge';
import { TooltipWrapper } from '@/components/ui/tooltip';
import { useLocale, useTranslations } from 'next-intl';
import React from 'react';
import { StringLanguage } from 'vitnode-shared/string-language.dto';

export const DescFieldContentMainSettingsCoreAdmin = ({
  defaultLanguage,
  ...props
}: AutoFormComponentProps & {
  defaultLanguage: string;
}) => {
  const t = useTranslations('admin.core.settings.main');
  const locale = useLocale();
  const [selectedLanguage, setSelectedLanguage] = React.useState(
    locale || defaultLanguage,
  );
  const current: StringLanguage = props.field.value.find(
    (item: StringLanguage) => item.language_code === selectedLanguage,
  ) ?? {
    language_code: selectedLanguage,
    value: '',
  };

  return (
    <>
      <AutoFormStringLanguageInput
        {...props}
        onLanguageChange={setSelectedLanguage}
      />

      <div className="flex w-32 items-center justify-center">
        <TooltipWrapper content={t('description.seo')}>
          <Badge
            className="mt-1"
            variant={
              current.value.length >= 50 && current.value.length < 120
                ? 'outline'
                : current.value.length > 160 || current.value.length < 50
                  ? 'destructive'
                  : 'default'
            }
          >
            {current.value.length}/160
          </Badge>
        </TooltipWrapper>
      </div>
    </>
  );
};
