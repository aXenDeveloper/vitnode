import { fetcher } from '@/api/fetcher';
import { HeaderContent } from '@/components/ui/header-content';
import { getTranslations } from 'next-intl/server';
import { PermissionsStaff } from 'vitnode-shared/admin/staff.dto';

import { ActionsPermissionsAdminDevPluginAdmin } from './actions';
import { ContentPermissionsAdminDevPluginAdmin } from './content';

const getData = async (pluginCode: string) => {
  const { data } = await fetcher<PermissionsStaff[]>({
    url: `/admin/plugins/permissions-admin/${pluginCode}`,
  });

  return data;
};

export interface PermissionsAdminWithI18n {
  id: string;
  name: string;
  permissions: {
    id: string;
    name: string;
  }[];
}

export const PermissionsAdminDevPluginAdminView = async ({
  code,
}: {
  code: string;
}) => {
  const [t, data, tPlugin] = await Promise.all([
    getTranslations('admin.core.plugins.dev.permissions-admin'),
    getData(code),
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    getTranslations(`admin_${code}`),
  ]);

  const dataWithI18n: PermissionsAdminWithI18n[] = data.map(permission => {
    const nameKey = `admin_permissions.${permission.id}`;

    return {
      id: permission.id,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      name: tPlugin.has(nameKey) ? tPlugin(nameKey) : nameKey,
      permissions: permission.permissions.map(permission => {
        const nameKey = `admin_permissions.${permission}`;

        return {
          id: permission,
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error
          name: tPlugin.has(nameKey) ? tPlugin(nameKey) : nameKey,
        };
      }),
    };
  });

  return (
    <>
      <HeaderContent h1={t('title')}>
        <ActionsPermissionsAdminDevPluginAdmin dataWithI18n={dataWithI18n} />
      </HeaderContent>

      <ContentPermissionsAdminDevPluginAdmin dataWithI18n={dataWithI18n} />
    </>
  );
};
