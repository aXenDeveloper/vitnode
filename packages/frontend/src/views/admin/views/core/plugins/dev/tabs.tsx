'use client';

import { Tabs, TabsTrigger } from '@/components/ui/tabs';
import { usePathname } from '@/navigation';
import { useTranslations } from 'next-intl';

export const TabsDevPluginAdmin = ({ code }: { code: string }) => {
  const t = useTranslations('admin.core.plugins.dev');
  const pathname = usePathname();

  return (
    <Tabs className="mb-5">
      <TabsTrigger
        active={pathname === `/admin/core/plugins/${code}/dev`}
        href={`/admin/core/plugins/${code}/dev`}
        id="overview"
      >
        {t('overview.title')}
      </TabsTrigger>
      <TabsTrigger href={`/admin/core/plugins/${code}/dev/nav`} id="nav">
        {t('nav.title')}
      </TabsTrigger>
      <TabsTrigger
        href={`/admin/core/plugins/${code}/dev/permissions-admin`}
        id="permissions-admin"
      >
        {t('permissions-admin.title')}
      </TabsTrigger>
    </Tabs>
  );
};
