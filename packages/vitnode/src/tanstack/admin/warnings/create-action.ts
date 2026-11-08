import React from "react";

type RegisterWarningsCreate = (open: (() => void) | null) => void;

export const WarningsCreateActionContext =
  React.createContext<RegisterWarningsCreate>(() => undefined);

export const useRegisterWarningsCreate = (open: () => void) => {
  const register = React.use(WarningsCreateActionContext);

  React.useEffect(() => {
    register(open);

    return () => {
      register(null);
    };
  }, [register, open]);
};
