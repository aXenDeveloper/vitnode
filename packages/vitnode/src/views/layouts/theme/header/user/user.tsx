import { buttonVariants } from '@/components/ui/button';
import { getSessionApi } from '@/lib/api/get-session-api';
import { Link } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { getTranslations } from 'next-intl/server';

import { AuthUserHeader } from './auth/auth';

export const UserHeader = async () => {
  const [t, session] = await Promise.all([
    getTranslations('core.global'),
    getSessionApi(),
  ]);

  if (!session.user) {
    return (
      <>
        <Link
          className={cn(
            buttonVariants({
              variant: 'ghost',
            }),
          )}
          href="/login"
          prefetch
        >
          {t('login')}
        </Link>

        <Link className={cn(buttonVariants())} href="/register" prefetch>
          {t('register')}
        </Link>
      </>
    );
  }

  return <AuthUserHeader />;
};
