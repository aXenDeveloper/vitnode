import React from 'react';

export const DevPluginAdminContext = React.createContext({
  pluginCode: '',
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
