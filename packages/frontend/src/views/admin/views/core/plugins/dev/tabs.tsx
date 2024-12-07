'use client';

import { Tabs, TabsItem } from '@/components/ui/tabs';
import { usePathname } from '@/navigation';
import { useTranslations } from 'next-intl';

export const TabsDevPluginAdmin = ({ code }: { code: string }) => {
  const t = useTranslations('admin.core.plugins.dev');
  const pathname = usePathname();

  return (
    <Tabs className="mb-5">
      <TabsItem
        active={pathname === `/admin/core/plugins/${code}/dev`}
        href={`/admin/core/plugins/${code}/dev`}
      >
        {t('overview.title')}
      </TabsItem>
      <TabsItem href={`/admin/core/plugins/${code}/dev/nav`}>
        {t('nav.title')}
      </TabsItem>
      <TabsItem href={`/admin/core/plugins/${code}/dev/permissions-admin`}>
        {t('permissions-admin.title')}
      </TabsItem>
    </Tabs>
  );
};
