'use client';

import React from 'react';

import { EmailConfirmationView } from './email-confirmation-view';

const WrapperSignUpContext = React.createContext<{
  setShowSendingEmail: React.Dispatch<React.SetStateAction<string>>;
}>({
  setShowSendingEmail: () => {},
});

export const useWrapperSignUp = () => React.useContext(WrapperSignUpContext);

export const WrapperSignUp = ({ children }: { children: React.ReactNode }) => {
  const [sendingEmail, setShowSendingEmail] = React.useState('');

  return (
    <WrapperSignUpContext.Provider value={{ setShowSendingEmail }}>
      {sendingEmail ? <EmailConfirmationView email={sendingEmail} /> : children}
    </WrapperSignUpContext.Provider>
  );
};
