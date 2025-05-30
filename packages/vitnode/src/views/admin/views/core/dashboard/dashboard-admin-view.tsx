import { AlertTriangleIcon } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { Badge } from '@/components/ui/badge';
import { HeaderContent } from '@/components/ui/header-content';
import { getSessionAdminApi } from '@/lib/api/get-session-admin-api';
import { CONFIG } from '@/lib/config';

export const DashboardAdminView = async () => {
  const session = await getSessionAdminApi();
  const t = await getTranslations('admin.dashboard');
  if (!session) return null;
  const { vitnode_version } = session;

  return (
    <div className="container mx-auto p-4">
      <HeaderContent
        desc={t('version', { version: vitnode_version })}
        h1={
          <>
            <span>VitNode</span>
            {CONFIG.node_development && (
              <Badge
                className="ml-2 bg-yellow-500 text-black hover:bg-yellow-500 dark:bg-yellow-500 dark:hover:bg-yellow-500"
                variant="destructive"
              >
                <AlertTriangleIcon className="size-4" /> {t('dev_mode')}
              </Badge>
            )}
          </>
        }
      />
      <div>Dashboard Admin</div>
    </div>
  );
};
