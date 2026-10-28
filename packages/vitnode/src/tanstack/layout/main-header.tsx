import { SuspensionNotice } from "../moderation/suspension-notice";
import { Header } from "./header";
import { UserHeader } from "./user-header";

/**
 * The site `Header` with the signed-in user's menu - what the main layout
 * renders - followed by the suspension notice while the account is suspended.
 */
export const MainHeader = (
  props: Omit<React.ComponentProps<typeof Header>, "user">,
) => (
  <>
    <Header {...props} user={<UserHeader />} />
    <SuspensionNotice />
  </>
);
