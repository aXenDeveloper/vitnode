'use client';

import { PermissionSessionAdmin } from '@/api/get-session-admin-data';
import { SessionAdminContext } from '@/hooks/use-session-admin';
import { ShowAuthAdminObj } from 'vitnode-shared/admin/auth.dto';

export const WrapperAdminLayout = ({
  children,
  data,
}: {
  children: React.ReactNode;
  data: ShowAuthAdminObj;
}) => {
  const isInAdminPermission = ({
    plugin_code,
    group,
    permission,
  }: PermissionSessionAdmin) => {
    if (data.permissions.length === 0) return true;
    const findPlugin = data.permissions.find(
      item => item.plugin_code === plugin_code,
    );
    const findGroup = findPlugin?.groups.find(item => item.id === group);
    if (findGroup?.permissions.length === 0) return true;
    const findPermission = findGroup?.permissions.find(
      item => item === permission,
    );

    return !!findPermission;
  };

  return (
    <SessionAdminContext.Provider value={{ ...data, isInAdminPermission }}>
      {children}
    </SessionAdminContext.Provider>
  );
};
