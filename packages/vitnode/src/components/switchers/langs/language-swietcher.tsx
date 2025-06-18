'use client';

import { CheckIcon, LanguagesIcon } from 'lucide-react';
import { useLocale } from 'next-intl';
import React from 'react';

import type { LocaleConfig } from '@/vitnode.config';

import { usePathname, useRouter } from '@/lib/navigation';

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

  const pathname = usePathname();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
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
