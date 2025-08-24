'use client';

import { CheckIcon, LanguagesIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import React from 'react';
import { usePathname, useRouter } from '@/lib/navigation';
import type { LocaleConfig } from '@/vitnode.config';

import { Button } from '../../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';

export const LanguageSwitcher = ({ locales }: { locales: LocaleConfig[] }) => {
  const currentLocale = useLocale();
  const [isPending, startTransition] = React.useTransition();
  const { replace } = useRouter();
  const t = useTranslations('core.global');
  const pathname = usePathname();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={t('language_switcher')}
          className="relative"
          isLoading={isPending}
          size="icon"
          variant="ghost"
        >
          <LanguagesIcon />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent>
        {locales.map(locale => (
          <DropdownMenuItem
            key={locale.code}
            onClick={() => {
              startTransition(() => {
                replace(pathname, {
                  locale: locale.code,
                });
              });
            }}
          >
            {locale.name}
            {locale.code === currentLocale && <CheckIcon className="ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
