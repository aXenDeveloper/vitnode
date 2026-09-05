"use client";

import { ArrowLeftIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { RoleFormatContent } from "@/components/role-format-content";
import { buttonVariants } from "@/components/ui/button";
import { HeaderContent } from "@/components/ui/header-content";
import { EditStaffFormContent } from "@/views/admin/views/core/staff/edit/edit-staff-form-content";
import { StaffUserFormatContent } from "@/views/admin/views/core/staff/table/staff-user-format-content";

import type {
  AdminStaffEditRouteData,
  AdminStaffEditSubject,
} from "./edit-route";

import { RouteMessages } from "../../i18n/route-messages";
import { ADMIN_STAFF_EDIT_NAMESPACES } from "./edit-route";
import { useStaffSaveCallback } from "./query";

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
