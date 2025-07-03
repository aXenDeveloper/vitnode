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
      className={cn(
        'bg-background/75 sticky top-0 z-20 w-full border-b shadow-sm backdrop-blur',
        className,
      )}
      {...props}
    >
      <div className="container mx-auto flex h-14 items-center px-4 py-2">
        <Link href="/">{logo}</Link>

        <div className="ml-auto flex items-center gap-2">
          <LanguageSwitcher locales={vitNodeConfig.i18n.locales} />
          <ThemeSwitcher />
          <React.Suspense fallback={<Skeleton className="h-9 w-32" />}>
            <UserHeader />
          </React.Suspense>
        </div>
      </div>
    </header>
  );
};
