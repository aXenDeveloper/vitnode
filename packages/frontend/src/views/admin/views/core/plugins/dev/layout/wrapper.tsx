'use client';

import {
  DevPluginAdminContext,
  DevPluginAdminContextArgs,
} from '../hooks/use-dev-plugin';

export const WrapperDevPluginAdminLayout = ({
  children,
  data,
}: {
  children: React.ReactNode;
  data: DevPluginAdminContextArgs;
}) => {
  return (
    <DevPluginAdminContext.Provider value={data}>
      {children}
    </DevPluginAdminContext.Provider>
  );
};
