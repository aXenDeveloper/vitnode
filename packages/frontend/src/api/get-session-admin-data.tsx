import { ErrorView } from '@/views/theme/views/error/error-view';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ShowAuthAdminObj } from 'vitnode-shared/admin/auth.dto';

import { fetcher } from './fetcher';
import { getAdminIdCookie } from './get-user-id-cookie';
import { RevalidateTagEnum } from './revalidate-tags';

export const getSessionAdminData = async () => {
  const adminIdFromCookie = await getAdminIdCookie();

  const { data } = await fetcher<ShowAuthAdminObj>({
    url: '/admin/auth',
    cache: 'force-cache',
    next: {
      tags: [
        adminIdFromCookie
          ? `${RevalidateTagEnum.Admin_Core_Sessions}--${adminIdFromCookie}`
          : RevalidateTagEnum.Admin_Core_Sessions,
      ],
    },
  });

  return data;
};

export interface PermissionSessionAdmin {
  group: string;
  permission: string;
  plugin_code: string;
}

export const checkAdminPermissionPage = async ({
  plugin_code,
  group,
  permission,
}: PermissionSessionAdmin) => {
  try {
    const { permissions } = await getSessionAdminData();
    if (permissions.length === 0) return;
    const findPlugin = permissions.find(
      item => item.plugin_code === plugin_code,
    );
    const findGroup = findPlugin?.groups.find(item => item.id === group);
    if (findGroup?.permissions.length === 0) return;
    const findPermission = findGroup?.permissions.find(
      item => item === permission,
    );
    if (!findPermission) return <ErrorView code="403" />;

    return;
  } catch (_) {
    return <ErrorView code="500" />;
  }
};

export const checkAdminPermissionPageMetadata = async ({
  plugin_code,
  group,
  permission,
}: PermissionSessionAdmin): Promise<Metadata> => {
  const { permissions } = await getSessionAdminData();
  if (permissions.length === 0) return {};
  const findPlugin = permissions.find(item => item.plugin_code === plugin_code);
  const findGroup = findPlugin?.groups.find(item => item.id === group);
  if (findGroup?.permissions.length === 0) return {};
  const findPermission = findGroup?.permissions.find(
    item => item === permission,
  );
  if (!findPermission) {
    const t = await getTranslations('core.global.errors');

    return {
      title: t('403'),
    };
  }

  return {};
};

export const isInAdminPermission = async ({
  plugin_code,
  group,
  permission,
}: PermissionSessionAdmin) => {
  const { permissions } = await getSessionAdminData();
  if (permissions.length === 0) return true;
  const findPlugin = permissions.find(item => item.plugin_code === plugin_code);
  const findGroup = findPlugin?.groups.find(item => item.id === group);
  if (findGroup?.permissions.length === 0) return true;
  const findPermission = findGroup?.permissions.find(
    item => item === permission,
  );

  return !!findPermission;
};
