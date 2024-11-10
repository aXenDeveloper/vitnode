import React from 'react';
import { ShowMiddlewareObj } from 'vitnode-shared/middleware.dto';

export const MiddlewareContext = React.createContext<ShowMiddlewareObj>(
  {} as ShowMiddlewareObj,
);

export const useMiddlewareData = () => {
  const hook = React.useContext(MiddlewareContext);

  if (!hook) {
    throw new Error(
      'useMiddlewareData must be used within a RootProviders component!',
    );
  }

  return hook;
};
