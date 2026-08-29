"use client";

import type { QueryClient } from "@tanstack/react-query";

import { notFound } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import { createTranslator, useTranslations } from "use-intl";

import type { PermissionStaffType } from "@/api/lib/permission-staff";
import type { StaffPluginGroup } from "@/views/admin/views/core/staff/staff-model";
import type {
  AdminStaffRole,
  AdminStaffRow,
} from "@/views/admin/views/core/staff/staff-query";
import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { RoleFormatContent } from "@/components/role-format-content";
import { buttonVariants } from "@/components/ui/button";
import { HeaderContent } from "@/components/ui/header-content";
import { adminStaffPermissions } from "@/views/admin/views/core/shared/admin-permissions";
import { EditStaffFormContent } from "@/views/admin/views/core/staff/edit/edit-staff-form-content";
import {
  buildStaffPermissionGroups,
  chunkStaffLabelKeys,
  grantedStaffPermissionKeys,
  normalizeStaffEntryId,
  staffLabelKeys,
  staffLabelLookupFrom,
  staffListHref,
} from "@/views/admin/views/core/staff/staff-model";
import { StaffUserFormatContent } from "@/views/admin/views/core/staff/table/staff-user-format-content";

import type { AdminScreenContext } from "../screen";

import { intlQueryOptions, MAX_NAMESPACES } from "../../i18n/query";
import { RouteMessages } from "../../i18n/route-messages";
import { adminIdentityOf } from "../identity";
import { requireAdminPermission } from "../screen";
import {
  adminStaffCatalogQuery,
  adminStaffEntryQuery,
  useStaffSaveCallback,
} from "./query";

/**
 * `/admin/core/staff/{admins,moderators}/edit/$id` - choosing what a staff entry
 * may do.
 *
 * The permission is `staff_admins.can_edit` or `staff_moderators.can_edit`,
 * checked in the loader and again by `showPermissionsStaffAdminRoute` and
 * `updatePermissionsStaffAdminRoute` on every request. On top of it the API
 * refuses two entries outright: a `protected` one, and one that governs the
 * *caller's own* access. Both are rendered as a sentence instead of a form,
 * exactly as the Next.js page does, because a form that cannot be submitted is
 * worse than an explanation.
 */

/**
 * What this screen renders strings from.
 *
 * Only the screen's own furniture. The *permission labels* are deliberately not
 * here - see {@link loadStaffPermissionLabels}.
 */
export const ADMIN_STAFF_EDIT_NAMESPACES = [
  "admin.staff",
  "core.global",
] as const;

/**
 * Every permission label the catalog needs, as a resolved map.
 *
 * ## Why this is not a namespace
 *
 * A plugin declares its permission labels as *flat top-level message keys* -
 * `"@vitnode/core:users:can_view"` - so that a plugin's own locale file can
 * merge them into one tree without knowing about any other plugin. There is no
 * namespace to slice them by: a catalog with ten modules and thirty permissions
 * is forty-one separate keys, and the i18n runtime refuses more than
 * `MAX_NAMESPACES` per request - a bound on a public `POST` endpoint that exists
 * for good reasons and is not going to be relaxed for one screen.
 *
 * So the labels are fetched as *data* rather than mounted as context: the keys
 * are enumerated from the catalog, requested in chunks the runtime accepts, and
 * merged into one lookup the pure model turns into the checkbox tree. Each chunk
 * is an ordinary `intlQueryOptions` entry, so a second visit to this screen -
 * or the other staff list, whose catalog overlaps entirely - is served from
 * cache.
 *
 * Sequential rather than parallel on purpose: the chunks share one underlying
 * message load, and firing four requests at a cold cache means four full loads
 * of the same tree.
 */
export const loadStaffPermissionLabels = async ({
  keys,
  locale,
  queryClient,
}: {
  keys: readonly string[];
  locale: string;
  queryClient: QueryClient;
}): Promise<Record<string, unknown>> => {
  const merged: Record<string, unknown> = {};

  for (const namespaces of chunkStaffLabelKeys(keys, MAX_NAMESPACES)) {
    const intl = await queryClient.ensureQueryData(
      intlQueryOptions({ locale, namespaces }),
    );
    Object.assign(merged, intl.messages);
  }

  return merged;
};

/** The entry, reduced to what the screen actually renders about it. */
export interface AdminStaffEditSubject {
  protected: boolean;
  role: AdminStaffRole | null;
  self: boolean;
  user: AdminStaffRow["user"];
}

export interface AdminStaffEditRouteData {
  backHref: string;
  backLabel: string;
  grantedKeys: string[];
  id: string;
  plugins: StaffPluginGroup[];
  subject: AdminStaffEditSubject;
  title: string;
  type: PermissionStaffType;
  unrestricted: boolean;
}

/**
 * Everything this screen needs, resolved before it renders.
 *
 * The catalog and the entry are fetched together; the labels depend on the
 * catalog, so they follow it. The permission tree is then built by
 * `buildStaffPermissionGroups`, which is pure and tested - so what the form
 * renders and what the save sends are two views of one model rather than two
 * implementations of one rule.
 *
 * A refusal propagates: `403` here means this administrator may not edit this
 * staff group, and `404` means the entry was removed. Both are the router's
 * error path rather than a form rendered around missing data.
 */
export const loadAdminStaffEditRoute = async ({
  adminAccess,
  id: raw,
  locale,
  queryClient,
  type,
}: AdminScreenContext & {
  /** The `$id` segment, exactly as it was typed. Nothing has checked it yet. */
  id: string;
  type: PermissionStaffType;
}): Promise<AdminStaffEditRouteData> => {
  requireAdminPermission(adminAccess, adminStaffPermissions(type).edit);

  /**
   * The one place `$id` becomes an entry id - the same rule, and the same
   * reason for it being here rather than in `params.parse`, as the user detail
   * route. See `users/detail-route.tsx`.
   */
  const id = normalizeStaffEntryId(raw);
  if (id === null) {
    // TanStack Router's own control-flow signal.
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw notFound();
  }

  const adminUserId = adminIdentityOf(adminAccess);

  const [intl, catalog, entry] = await Promise.all([
    queryClient.ensureQueryData(
      intlQueryOptions({ locale, namespaces: ADMIN_STAFF_EDIT_NAMESPACES }),
    ),
    queryClient.ensureQueryData(adminStaffCatalogQuery({ adminUserId })),
    queryClient.ensureQueryData(
      adminStaffEntryQuery({ adminUserId, id, type }),
    ),
  ]);

  const labels = await loadStaffPermissionLabels({
    keys: staffLabelKeys({ catalog, type }),
    locale,
    queryClient,
  });

  const t = createTranslator({
    locale,
    messages: intl.messages as {
      admin: { staff: { edit: { back: string; title: string } } };
    },
    namespace: "admin.staff.edit",
  });

  return {
    backHref: staffListHref(type),
    backLabel: t("back"),
    grantedKeys: [...grantedStaffPermissionKeys(entry.permissions)],
    id,
    plugins: buildStaffPermissionGroups({
      catalog,
      label: staffLabelLookupFrom(labels),
      type,
    }),
    subject: {
      protected: entry.protected,
      role: entry.role,
      self: entry.self,
      user: entry.user,
    },
    title: t("title"),
    type,
    unrestricted: entry.unrestricted,
  };
};

export interface AdminStaffEditRouteProps extends AdminStaffEditRouteData {
  LinkComponent: AuthLinkComponent;
  /** Where a saved entry returns to. The host navigates; the package decides. */
  navigate: (href: string) => Promise<void> | void;
}

export const AdminStaffEditRouteContent = ({
  backHref,
  backLabel,
  grantedKeys,
  id,
  LinkComponent,
  navigate,
  plugins,
  subject,
  title,
  type,
  unrestricted,
}: AdminStaffEditRouteProps) => {
  const onSave = useStaffSaveCallback();

  return (
    <RouteMessages namespaces={ADMIN_STAFF_EDIT_NAMESPACES}>
      <div className="mx-auto max-w-4xl p-4">
        <StaffEditHeader
          backHref={backHref}
          backLabel={backLabel}
          LinkComponent={LinkComponent}
          subject={subject}
          title={title}
        />

        <StaffEditBody
          grantedKeys={grantedKeys}
          id={id}
          onSave={onSave}
          onSaved={async () => {
            await navigate(backHref);
          }}
          plugins={plugins}
          subject={subject}
          type={type}
          unrestricted={unrestricted}
        />
      </div>
    </RouteMessages>
  );
};

const StaffEditHeader = ({
  backHref,
  backLabel,
  LinkComponent,
  subject,
  title,
}: {
  backHref: string;
  backLabel: string;
  LinkComponent: AuthLinkComponent;
  subject: AdminStaffEditSubject;
  title: string;
}) => {
  const t = useTranslations("admin.staff.edit");

  return (
    <HeaderContent
      desc={
        <div className="flex items-center gap-2">
          {t("subject")}
          {subject.role ? (
            <RoleFormatContent role={subject.role} />
          ) : subject.user ? (
            <StaffUserFormatContent user={subject.user} />
          ) : null}
        </div>
      }
      h1={title}
    >
      <LinkComponent
        className={buttonVariants({ variant: "outline" })}
        href={backHref}
      >
        <ArrowLeftIcon />
        {backLabel}
      </LinkComponent>
    </HeaderContent>
  );
};

/**
 * The form, or the sentence that replaces it.
 *
 * `protected` and `self` are the two entries the API refuses to update, so the
 * screen says why instead of offering a save that would answer `403`.
 */
const StaffEditBody = ({
  grantedKeys,
  id,
  onSave,
  onSaved,
  plugins,
  subject,
  type,
  unrestricted,
}: Omit<
  AdminStaffEditRouteProps,
  "backHref" | "backLabel" | "LinkComponent" | "navigate" | "title"
> & {
  onSave: ReturnType<typeof useStaffSaveCallback>;
  onSaved: () => Promise<void>;
}) => {
  const t = useTranslations("admin.staff.edit");

  if (subject.protected) {
    return <p className="text-muted-foreground">{t("protected")}</p>;
  }
  if (subject.self) {
    return <p className="text-muted-foreground">{t("self")}</p>;
  }

  return (
    <EditStaffFormContent
      grantedKeys={grantedKeys}
      id={id}
      onSave={onSave}
      onSaved={onSaved}
      plugins={plugins}
      type={type}
      unrestricted={unrestricted}
    />
  );
};
