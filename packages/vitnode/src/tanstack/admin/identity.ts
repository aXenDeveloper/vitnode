import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";

import type { AdminAccessState } from "./session-api";

import { useAdminAccess } from "./permissions";

export const adminIdentityOf = (access: AdminAccessState): AdminIdentity =>
  access.status === "granted" ? access.session.user.id : null;

export const useAdminIdentity = (): AdminIdentity =>
  adminIdentityOf(useAdminAccess());

export type { AdminIdentity };
