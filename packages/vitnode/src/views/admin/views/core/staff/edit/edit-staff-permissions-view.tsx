import { ArrowLeftIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import type { PermissionStaffType } from "@/api/lib/permission-staff";

import { adminModule } from "@/api/modules/admin/admin.module";
import { RoleFormatContent } from "@/components/role-format-content";
import { Button } from "@/components/ui/button";
import { HeaderContent } from "@/components/ui/header-content";
import { checkAdminPermissionApi } from "@/lib/api/get-session-admin-api";
import { fetcher } from "@/lib/fetcher";
import { Link } from "@/lib/navigation";
import { adminStaffPermissions } from "@/views/admin/views/core/shared/admin-permissions";

import {
  buildStaffPermissionGroups,
  grantedStaffPermissionKeys,
  normalizeStaffEntryId,
  staffListHref,
} from "../staff-model";
import {
  adminStaffCatalogRequest,
  adminStaffEntryRequest,
} from "../staff-query";
import { StaffUserFormatContent } from "../table/staff-user-format-content";
import { EditStaffPermissionsForm } from "./edit-staff-form-next";

/**
 * Choosing what a staff entry may do, as this application's Server Component.
 *
 * The two reads and the permission check are here; the permission *tree* is
 * built by `buildStaffPermissionGroups`, which is pure and shared with the
 * TanStack AdminCP - so the checkbox tree, the dependency locks and the set that
 * is finally submitted are one implementation rather than two.
 *
 * Labels come from the root translator, because a permission label is a *flat*
 * top-level message key (`"@vitnode/core:users:can_view"`) that a plugin ships
 * in its own locale file. Next.js can read the whole merged tree, so it simply
 * asks; the TanStack route has to fetch those keys in chunks, because its i18n
 * runtime takes namespaces and bounds how many. Two mechanisms, one lookup
 * signature - `StaffLabelLookup`.
 */
export const EditStaffPermissionsView = async ({
  id: raw,
  type,
}: {
  id: string;
  type: PermissionStaffType;
}) => {
  // The same normalisation the TanStack loader applies, and for the same reason:
  // `Number("abc")` is `NaN`, and `?id=NaN` is a request nobody meant to make.
  const id = normalizeStaffEntryId(raw);
  if (id === null) {
    notFound();
  }

  const canEdit = await checkAdminPermissionApi(
    adminStaffPermissions(type).edit,
  );
  if (!canEdit) {
    notFound();
  }

  const t = await getTranslations("admin.staff.edit");
  const tRoot = (await getTranslations()) as unknown as ((
    key: string,
  ) => string) & { has: (key: string) => boolean };

  const [catalogRes, entryRes] = await Promise.all([
    fetcher(adminModule, adminStaffCatalogRequest()),
    fetcher(adminModule, adminStaffEntryRequest(type, id)),
  ]);

  if (entryRes.status !== 200 || catalogRes.status !== 200) {
    notFound();
  }

  const [catalog, entry] = await Promise.all([
    catalogRes.json(),
    entryRes.json(),
  ]);

  const plugins = buildStaffPermissionGroups({
    catalog,
    label: key => (tRoot.has(key) ? tRoot(key) : undefined),
    type,
  });

  return (
    <>
      <HeaderContent
        desc={
          <div className="flex items-center gap-2">
            {t("subject")}
            {entry.role ? (
              <RoleFormatContent role={entry.role} />
            ) : entry.user ? (
              <StaffUserFormatContent user={entry.user} />
            ) : null}
          </div>
        }
        h1={t("title")}
      >
        <Button
          nativeButton={false}
          render={<Link href={staffListHref(type)} />}
          variant="outline"
        >
          <ArrowLeftIcon />
          {t("back")}
        </Button>
      </HeaderContent>

      {entry.protected ? (
        <p className="text-muted-foreground">{t("protected")}</p>
      ) : entry.self ? (
        <p className="text-muted-foreground">{t("self")}</p>
      ) : (
        <EditStaffPermissionsForm
          grantedKeys={[...grantedStaffPermissionKeys(entry.permissions)]}
          id={id}
          plugins={plugins}
          type={type}
          unrestricted={entry.unrestricted}
        />
      )}
    </>
  );
};
