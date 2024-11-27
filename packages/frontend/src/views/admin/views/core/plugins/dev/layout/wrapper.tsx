'use client';

import { DevPluginAdminContext } from '../hooks/use-dev-plugin';

export const WrapperDevPluginAdminLayout = ({
  children,
  pluginCode,
}: {
  children: React.ReactNode;
  pluginCode: string;
}) => {
  return (
    <DevPluginAdminContext.Provider value={{ pluginCode }}>
      {children}
    </DevPluginAdminContext.Provider>
  );
};
