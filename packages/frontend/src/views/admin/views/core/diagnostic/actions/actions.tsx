import { Button } from '@/components/ui/button';
import { Link } from '@/navigation';
import { LifeBuoy } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { ClearCacheActionDiagnostic } from './clear_cache/clear_cache';

export const ActionsDiagnosticTools = () => {
  const t = useTranslations('admin.core.diagnostic');

  return (
    <>
      <Button asChild variant="ghost">
        <Link
          href="https://github.com/VitNode/vitnode/issues"
          rel="noopener noreferrer"
          target="_blank"
        >
          <LifeBuoy />
          {t('get_support')}
        </Link>
      </Button>
      <ClearCacheActionDiagnostic />
    </>
  );
};
