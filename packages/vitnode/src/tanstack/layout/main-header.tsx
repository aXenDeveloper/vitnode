import { Header } from "./header";
import { UserHeader } from "./user-header";

export const MainHeader = ({ logo }: { logo?: React.ReactNode }) => (
  <Header logo={logo} user={<UserHeader />} />
);
