import { SuspensionGate } from "../moderation/suspension-gate";
import { Header } from "./header";
import { UserHeader } from "./user-header";

/**
 * The site `Header` with the signed-in user's menu - what the main layout
 * renders. While the account is suspended it also shows the suspension dialog
 * and keeps the member on the home page.
 */
export const MainHeader = (
  props: Omit<React.ComponentProps<typeof Header>, "user">,
) => (
  <>
    <Header {...props} user={<UserHeader />} />
    <SuspensionGate />
  </>
);
