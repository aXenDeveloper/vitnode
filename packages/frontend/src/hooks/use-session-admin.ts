import { PermissionSessionAdmin } from '@/api/get-session-admin-data';
import React from 'react';
import { ShowAuthAdminObj } from 'vitnode-shared/admin/auth.dto';

interface Args extends ShowAuthAdminObj {
  isInAdminPermission: (args: PermissionSessionAdmin) => boolean;
}

export const SessionAdminContext = React.createContext<Args>({} as Args);

export const useSessionAdmin = () => {
  const hook = React.useContext(SessionAdminContext);

  if (!hook) {
    throw new Error(
      'useSessionAdmin must be used within a AdminLayout component!',
    );
  }

  return hook;
};
