import { getTranslations } from "next-intl/server";

import type { StaffPermissionSet } from "@/api/lib/permission-staff";
import type { VitNodeConfig } from "@/vitnode.config";

import { EMPTY_STAFF_PERMISSION_SET } from "@/api/lib/staff-permission";
import { getSessionAdminApi } from "@/lib/api/get-session-admin-api";
import { getVitNodeConfig } from "@/vitnode.config";

import type { AdminNavTranslator, NavAdminParent } from "./nav-model";

import { buildAdminNav } from "./nav-model";

export type {
  AdminNavItem,
  AdminNavSubItem,
  AdminNavTranslator,
  NavAdminParent,
} from "./nav-model";

/**
 * {@link buildAdminNav}, wired to Next.js.
 *
 * The rules live in `./nav-model`, which is pure and shared. What is left here
 * is the two answers only this framework can give: the active request's
 * translator (`next-intl/server`) and the signed-in admin's permission set
 * (`getSessionAdminApi`, memoised per render pass).
 *
 * `translator` stays overridable because the AdminCP search index builds the nav
 * once per enabled locale, to make a page findable by its name in any of them -
 * see `../../search/get-search-nav-items`.
 *
 * A session that could not be read yields no permissions rather than throwing,
 * which is the same fallback the layout applies: the sidebar renders empty, and
 * the page it frames is the one that reports the failure.
 */
export const getAdminNav = async ({
  translator,
  vitNodeConfig = getVitNodeConfig(),
}: {
  translator?: AdminNavTranslator;
  vitNodeConfig?: VitNodeConfig;
} = {}): Promise<NavAdminParent[]> => {
  const activeTranslator = await getTranslations();
  const t = translator ?? (activeTranslator as unknown as AdminNavTranslator);
  const session = await getSessionAdminApi();
  const permissions: StaffPermissionSet =
    session?.permissions ?? EMPTY_STAFF_PERMISSION_SET;

  return buildAdminNav({ permissions, t, vitNodeConfig });
};
