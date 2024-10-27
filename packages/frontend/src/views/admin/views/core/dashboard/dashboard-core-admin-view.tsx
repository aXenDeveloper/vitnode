import { getSessionAdminData } from '@/api/get-session-admin-data';
import { Badge } from '@/components/ui/badge';
import { HeaderContent } from '@/components/ui/header-content';
import { CONFIG } from '@/helpers/config-with-env';
import { AlertTriangle } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { WarnReqRestartServer } from '../warn-req-restart-server';
import { Test } from './test';

export const DashboardCoreAdminView = async () => {
  const [{ version_of_vitnode }, t] = await Promise.all([
    getSessionAdminData(),
    getTranslations('admin.global'),
  ]);

  return (
    <>
      <HeaderContent
        desc={t('version', { version: version_of_vitnode })}
        h1={
          <>
            <span>VitNode</span>
            {CONFIG.node_development && (
              <Badge
                className="ml-2 bg-yellow-500 text-black hover:bg-yellow-500"
                variant="destructive"
              >
                <AlertTriangle className="size-4" /> {t('dev_mode')}
              </Badge>
            )}
          </>
        }
      >
        {/* {(await isInAdminPermission({
          plugin_code: 'core',
          group: 'dashboard',
          permission: 'can_manage_diagnostic_tools',
        })) && (
          <Button asChild>
            <Link href="/admin/core/diagnostic">
              <HammerIcon />
              {t('diagnostic_tools')}
            </Link>
          </Button>
        )} */}
      </HeaderContent>

      <WarnReqRestartServer />

      <Test />
    </>
  );
};
