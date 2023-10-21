import { Home } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/i18n';
import { UserBarAdmin } from './user-bar/user-bar-admin';
import { buttonVariants } from '@/components/ui/button';

export const HeaderAdmin = () => {
  const t = useTranslations('admin');

  return (
    <header className="h-16 sticky top-0 z-50 bg-card backdrop-blur flex items-center gap-4 justify-between px-5">
      <Link href="/admin/core">VitNode</Link>

      <div className="flex items-center gap-4 justify-between">
        <Link href="/" className={buttonVariants({ variant: 'ghost' })}>
          <Home />
          <span>{t('home_page')}</span>
        </Link>
        <UserBarAdmin />
      </div>
    </header>
  );
};
