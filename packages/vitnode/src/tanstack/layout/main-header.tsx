import { Header } from "./header";
import { UserHeader } from "./user-header";

/** The site `Header` with the signed-in user's menu - what the main layout renders. */
export const MainHeader = (
  props: Omit<React.ComponentProps<typeof Header>, "user">,
) => <Header {...props} user={<UserHeader />} />;
