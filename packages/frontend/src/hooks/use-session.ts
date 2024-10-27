import React from 'react';
import { ShowAuthObj } from 'vitnode-shared/auth.dto';

export const SessionContext = React.createContext<ShowAuthObj>(
  {} as ShowAuthObj,
);

export const useSession = () => {
  const hook = React.useContext(SessionContext);

  if (!hook) {
    throw new Error(
      'useSession must be used within a RootProviders component!',
    );
  }

  return hook;
};
