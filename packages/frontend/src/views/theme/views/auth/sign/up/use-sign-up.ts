import React from 'react';

export const SignUpContext = React.createContext<{
  setEmailSuccess: (email: string) => void;
}>({
  setEmailSuccess: () => {},
});

export const useSignUp = () => React.useContext(SignUpContext);
