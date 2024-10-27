import { getSessionData } from '@/api/get-session-data';
import { InternalErrorView } from '@/views/global';
import React from 'react';

import { WrapperAuthLayout } from './wrapper';

export const AuthLayout = async ({
  children,
}: {
  children: React.ReactNode;
}) => {
  try {
    const data = await getSessionData();

    return <WrapperAuthLayout data={data}>{children}</WrapperAuthLayout>;
  } catch (_) {
    return <InternalErrorView />;
  }
};
