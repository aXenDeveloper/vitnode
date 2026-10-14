import { Header } from "./header";
import { UserHeader } from "./user-header";

export const MainHeader = (
  props: Omit<React.ComponentProps<typeof Header>, "user">,
) => <Header {...props} user={<UserHeader />} />;
