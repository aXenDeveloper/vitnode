"use client";

import React from "react";

import { EmailConfirmationView } from "./email-confirmation-view";

const WrapperSignUpContext = React.createContext<{
  setShowSendingEmail: React.Dispatch<React.SetStateAction<string>>;
}>({
  setShowSendingEmail: () => {},
});

export const useWrapperSignUp = () => React.use(WrapperSignUpContext);

export const WrapperSignUp = ({ children }: { children: React.ReactNode }) => {
  const [sendingEmail, setShowSendingEmail] = React.useState("");

  const contextValue = React.useMemo(
    () => ({ setShowSendingEmail }),
    [setShowSendingEmail],
  );

  return (
    <WrapperSignUpContext value={contextValue}>
      {sendingEmail ? <EmailConfirmationView email={sendingEmail} /> : children}
    </WrapperSignUpContext>
  );
};
