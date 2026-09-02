import "@tanstack/react-start/server-only";

import { adminModule } from "@/api/modules/admin/admin.module";
import { fetcher } from "@/tanstack/fetcher/server";

import {
  adminSessionFailureFromError,
  adminSessionFailureFromStatus,
} from "./state";

export const readAdminSessionOnApi = async () => {
  try {
    const response = await fetcher(adminModule, {
      method: "get",
      module: "admin",
      path: "/session",
    });

    if (response.status === 200) {
      return { session: await response.json(), status: "granted" as const };
    }

    return adminSessionFailureFromStatus(response.status);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[admin] the admin session could not be read", error);

    return adminSessionFailureFromError(error);
  }
};

export { readAdminUserSearchOnApi } from "./search-server";
