import type { ReactNode } from "react";

import { NavAdmin } from "./nav/nav-admin";
import { HeaderAdmin } from "./header/header-admin";

interface Props {
  children: ReactNode;
}

export const AdminLayout = ({ children }: Props) => {
  return (
    <>
      <HeaderAdmin />
      <NavAdmin />
      <main className="sm:ml-64 mt-16 p-5 sm:pl-2 text-card-foreground">
        {children}
      </main>
    </>
  );
};
