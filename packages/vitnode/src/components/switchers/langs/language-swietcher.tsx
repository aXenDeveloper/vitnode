'use client';

import { LanguagesIcon } from 'lucide-react';
import type { LocaleConfig } from '../../../vitnode.config';
import { Button } from '../../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { Link, usePathname, useRouter } from '../../../lib/navigation';
import { useLocale } from 'next-intl';

export const LanguageSwitcher = ({ locales }: { locales: LocaleConfig[] }) => {
  const locale = useLocale();
  const { push } = useRouter();
  const pathname = usePathname();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="relative" size="icon" variant="ghost">
          <LanguagesIcon />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent>
        {locales.map(locale => (
          <DropdownMenuItem key={locale.code} asChild>
            <Link href={`${pathname}/${locale.code}`} lang={locale.code}>
              {locale.name} - {`${pathname}/${locale.code}`}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
