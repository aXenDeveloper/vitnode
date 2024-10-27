import { Button } from '@/components/ui/button';
import dynamicIconImports from 'lucide-react/dynamicIconImports';
import { useTranslations } from 'next-intl';
import React from 'react';

import { IconClient } from '../../../icon-client';
import { IconPickerProps } from '../content';

interface Props extends IconPickerProps {
  search: string;
}

const iconNamesArray = Object.keys(dynamicIconImports);

export const IconsContentIconInput = ({
  onChange,
  search,
  setOpen,
  value,
}: Props) => {
  const t = useTranslations('core.global.icon_picker.icons');
  const data = iconNamesArray.filter(name =>
    name.toLowerCase().includes(search.toLowerCase()),
  );

  if (data.length === 0) {
    return <span className="text-muted-foreground">{t('not_found')}</span>;
  }

  return (
    <>
      {data.slice(0, 42).map(name => (
        <Button
          ariaLabel={name}
          key={name}
          onClick={() => {
            if (value === name) {
              onChange('');
              setOpen(false);

              return;
            }

            onChange(name);
            setOpen(false);
          }}
          size="icon"
          variant={value === name ? 'default' : 'ghost'}
        >
          <IconClient name={name} />
        </Button>
      ))}
    </>
  );
};
