import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

import { isSidebarOpenInCookies } from "@/components/ui/sidebar-cookie";

export const readAdminSidebarOpen = createIsomorphicFn()
  .server(() => {
    try {
      return isSidebarOpenInCookies(getRequestHeader("cookie"));
    } catch {
      return true;
    }
  })
  .client(() => isSidebarOpenInCookies(globalThis.document?.cookie));
