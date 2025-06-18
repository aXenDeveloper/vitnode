import { Suspense } from 'react';

import { ThemeSwitcher } from '@/components/switchers/themes/theme-switcher';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/lib/navigation';
import { cn } from '@/lib/utils';

import { UserHeader } from './user/user';
import { LanguageSwitcher } from '../../../../components/switchers/langs/language-swietcher';
import type { VitNodeConfig } from '../../../../vitnode.config';

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
        'bg-card/75 sticky top-0 z-20 w-full border-b shadow-sm backdrop-blur',
        className,
      )}
      {...props}
    >
      <div className="container mx-auto flex h-14 items-center px-4 py-2">
        <Link href="/" prefetch>
          {logo}
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <LanguageSwitcher locales={vitNodeConfig.i18n.locales} />
          <ThemeSwitcher />
          <Suspense fallback={<Skeleton className="h-9 w-32" />}>
            <UserHeader />
          </Suspense>
        </div>
      </div>
    </header>
  );
};
