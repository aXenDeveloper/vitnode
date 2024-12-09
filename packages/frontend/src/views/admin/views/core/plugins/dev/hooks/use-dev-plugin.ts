import React from 'react';
import { ShowPluginAdmin } from 'vitnode-shared/admin/plugins.dto';

export type DevPluginAdminContextArgs = Pick<
  ShowPluginAdmin,
  'code' | 'name' | 'version' | 'version_code'
>;

export const DevPluginAdminContext =
  React.createContext<DevPluginAdminContextArgs>({
    code: '',
    version: '',
    version_code: 0,
    name: '',
  });

export const useDevPluginAdmin = () => {
  const hook = React.useContext(DevPluginAdminContext);

  if (!hook) {
    throw new Error(
      'useDevPluginAdmin must be used inside dev plugin views in AdminCP!',
    );
  }

  return hook;
};
