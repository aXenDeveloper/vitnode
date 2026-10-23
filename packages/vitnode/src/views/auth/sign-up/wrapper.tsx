import React from "react";

import { AuthFrame } from "../auth-card";
import { EmailConfirmationView } from "./email-confirmation-view";

const WrapperSignUpContext = React.createContext<{
  setSendingEmail: React.Dispatch<React.SetStateAction<string>>;
}>({
  setSendingEmail: () => {},
});

export const useWrapperSignUp = () => React.use(WrapperSignUpContext);

export const WrapperSignUp = ({ children }: { children: React.ReactNode }) => {
  const [sendingEmail, setSendingEmail] = React.useState("");

  const contextValue = React.useMemo(
    () => ({ setSendingEmail }),
    [setSendingEmail],
  );

  return (
    <WrapperSignUpContext value={contextValue}>
      {sendingEmail ? (
        <AuthFrame>
          <EmailConfirmationView email={sendingEmail} />
        </AuthFrame>
      ) : (
        children
      )}
    </WrapperSignUpContext>
  );
};
