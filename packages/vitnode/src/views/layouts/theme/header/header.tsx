import { ThemeSwitcher } from '@/components/switchers/theme-switcher';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { Suspense } from 'react';

import { UserHeader } from './user/user';

export const HeaderLayout = ({
  logo,
  className,
  ...props
}: React.ComponentProps<'header'> & { logo: React.ReactNode }) => {
  return (
    <header
      className={cn(
        'bg-background/75 container sticky top-0 z-20 mx-auto flex w-full items-center border-b px-4 py-2 backdrop-blur sm:top-2 sm:rounded-xl sm:border',
        className,
      )}
      {...props}
    >
      <Link href="/" prefetch>
        {logo}
      </Link>

      <div className="ml-auto flex items-center gap-2">
        <ThemeSwitcher />
        <Suspense fallback={<Skeleton className="h-9 w-32" />}>
          <UserHeader />
        </Suspense>
      </div>
    </header>
  );
};
