import { adminNavBundle } from "@vitnode/core/tanstack/admin";

import { pluginAdminNav } from "#/admin-nav.gen";


export const adminNav = adminNavBundle({ plugins: pluginAdminNav });
