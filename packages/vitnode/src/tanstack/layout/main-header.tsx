"use client";

import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { Header } from "./header";
import { UserHeader } from "./user-header";

export const MainHeader = ({
  LinkComponent,
  logo,
}: {
  /** How a header path becomes a navigation, for the bar and the user menu. */
  LinkComponent?: AuthLinkComponent;
  /** The application's mark. Defaults to VitNode's. */
  logo?: React.ReactNode;
}) => (
  <Header
    LinkComponent={LinkComponent}
    logo={logo}
    user={<UserHeader LinkComponent={LinkComponent} />}
  />
);
