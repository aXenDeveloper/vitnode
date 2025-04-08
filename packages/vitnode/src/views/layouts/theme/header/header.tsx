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
        'bg-background/75 top-0 z-20 w-full border-b backdrop-blur sm:sticky',
        className,
      )}
      {...props}
    >
      <div className="container mx-auto flex h-16 items-center px-4">
        <Link href="/">{logo}</Link>

        <div className="ml-auto flex items-center gap-2">
          <ThemeSwitcher />
          <Suspense fallback={<Skeleton className="h-9 w-32" />}>
            <UserHeader />
          </Suspense>
        </div>
      </div>
    </header>
  );
};
