'use client';

import { SessionContext } from '@/hooks/use-session';
import { ShowAuthObj } from 'vitnode-shared/auth/auth.dto';

export const WrapperAuthLayout = ({
  children,
  data,
}: {
  children: React.ReactNode;
  data: ShowAuthObj;
}) => {
  return <SessionContext value={data}>{children}</SessionContext>;
};
