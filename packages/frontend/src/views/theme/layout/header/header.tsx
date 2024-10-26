import { getMiddlewareData } from '@/api/get-middleware-data';
import { getSessionData } from '@/api/get-session-data';
import { LanguageSwitcher } from '@/components/switchers/language-switcher';
import { ThemeSwitcher } from '@/components/switchers/theme-switcher';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/helpers/classnames';
import { Link } from '@/navigation';
import { getTranslations } from 'next-intl/server';
import React from 'react';

import { AuthUserBar } from './auth-user-bar/auth-user-bar';

export const Header = async ({ className }: { className?: string }) => {
  const [
    t,
    {
      authorization: { lock_register },
    },
    { user },
  ] = await Promise.all([
    getTranslations('core.global.user-bar'),
    getMiddlewareData(),
    getSessionData(),
  ]);

  return (
    <header
      className={cn(
        'bg-background/75 sticky top-0 z-20 w-full border-b backdrop-blur transition-colors',
        className,
      )}
    >
      <div className="container flex h-16 items-center gap-5 px-5">
        <div className="ml-auto hidden gap-2 sm:flex">
          <LanguageSwitcher />
          <ThemeSwitcher />
        </div>

        <div className="hidden items-center justify-center gap-4 sm:flex">
          {user ? (
            <React.Suspense fallback={null}>
              <AuthUserBar user={user} />
            </React.Suspense>
          ) : (
            <>
              <Link
                className={buttonVariants({
                  size: 'sm',
                  variant: 'outline',
                })}
                href="/login"
              >
                {t('sign_in')}
              </Link>

              {!lock_register && (
                <Link
                  className={buttonVariants({
                    size: 'sm',
                  })}
                  href="/register"
                >
                  {t('sign_up')}
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
};
