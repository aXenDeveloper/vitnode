'use client';

import { SessionAdminContext } from '@/hooks/use-session-admin';
import { ShowAuthAdminObj } from 'vitnode-shared/admin/auth.dto';

export const WrapperAdminLayout = ({
  children,
  data,
}: {
  children: React.ReactNode;
  data: ShowAuthAdminObj;
}) => {
  return (
    <SessionAdminContext.Provider value={data}>
      {children}
    </SessionAdminContext.Provider>
  );
};
