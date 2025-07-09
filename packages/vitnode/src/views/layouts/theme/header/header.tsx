import React from 'react';

import type { VitNodeConfig } from '@/vitnode.config';

import { LanguageSwitcher } from '@/components/switchers/langs/language-swietcher';
import { ThemeSwitcher } from '@/components/switchers/themes/theme-switcher';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/lib/navigation';
import { cn } from '@/lib/utils';

import { UserHeader } from './user/user';

export const HeaderLayout = ({
  logo,
  className,
  vitNodeConfig,
  ...props
}: React.ComponentProps<'header'> & {
  logo: React.ReactNode;
  vitNodeConfig: VitNodeConfig;
}) => {
  return (
    <header
      className={cn('sticky top-0 z-20 w-full sm:top-2', className)}
      {...props}
    >
      <div className="bg-card/75 container mx-auto flex h-14 items-center border-b px-4 py-2 backdrop-blur sm:rounded-lg sm:border sm:shadow-sm">
        <Link href="/">{logo}</Link>

        <div className="ml-auto flex items-center gap-2">
          {vitNodeConfig.i18n.locales.length > 1 && (
            <LanguageSwitcher locales={vitNodeConfig.i18n.locales} />
          )}
          <ThemeSwitcher />
          <React.Suspense fallback={<Skeleton className="h-9 w-32" />}>
            <UserHeader />
          </React.Suspense>
        </div>
      </div>
    </header>
  );
};
