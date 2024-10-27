import React from 'react';
import { ShowAuthAdminObj } from 'vitnode-shared/admin/auth.dto';

export const SessionAdminContext = React.createContext<ShowAuthAdminObj>(
  {} as ShowAuthAdminObj,
);

export const useSessionAdmin = () => {
  const hook = React.useContext(SessionAdminContext);

  if (!hook) {
    throw new Error(
      'useSessionAdmin must be used within a AdminLayout component!',
    );
  }

  return hook;
};
