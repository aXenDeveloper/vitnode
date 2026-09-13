import { PencilIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import type {
  PersonalInformationFields,
  UserPersonalInformation,
} from "@/lib/user-personal-information";
import type { ProfileRole } from "@/views/profile/profile-query";

import { RoleFormatContent } from "@/components/role-format-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

import type { UpdatePersonalInformation } from "./personal-update";

const PersonalFormContent = React.lazy(async () =>
  import("./personal-form-content").then(module => ({
    default: module.PersonalFormContent,
  })),
);

const PersonalFormSkeleton = () => (
  <div aria-hidden="true" className="flex flex-col gap-4">
    <Skeleton className="h-14 w-full rounded-md" />
    <Skeleton className="h-14 w-full rounded-md" />
    <Skeleton className="h-14 w-full rounded-md" />
  </div>
);

const Detail = ({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) => (
  <div className="flex min-w-0 flex-col gap-1">
    <dt className="text-muted-foreground text-sm">{label}</dt>
    <dd className="text-foreground font-medium wrap-anywhere">{children}</dd>
  </div>
);

export interface PersonalInformationUser extends UserPersonalInformation {
  email: string;
  emailVerified: boolean;
  name: string;
  secondaryRoles: ProfileRole[];
}

export const PersonalInformationContent = ({
  canEdit,
  fields,
  onUpdate,
  user,
}: {
  canEdit: boolean;
  fields: PersonalInformationFields;
  onUpdate: UpdatePersonalInformation;
  user: PersonalInformationUser;
}) => {
  const t = useTranslations("core.auth.settings.overview");

  const details = [
    <Detail key="nickname" label={t("nickname")}>
      {user.name}
    </Detail>,
    fields.firstName && user.firstName !== null ? (
      <Detail key="firstName" label={t("firstName")}>
        {user.firstName}
      </Detail>
    ) : null,
    fields.lastName && user.lastName !== null ? (
      <Detail key="lastName" label={t("lastName")}>
        {user.lastName}
      </Detail>
    ) : null,
    fields.phone && user.phone !== null ? (
      <Detail key="phone" label={t("phone")}>
        <a className="hover:underline" href={`tel:${user.phone}`}>
          {user.phone}
        </a>
      </Detail>
    ) : null,
    <Detail key="email" label={t("email")}>
      <span className="flex flex-wrap items-center gap-2">
        {user.email}
        {user.emailVerified ? null : (
          <Badge variant="destructive">{t("emailNotVerified")}</Badge>
        )}
      </span>
    </Detail>,
    fields.headline && user.headline !== null ? (
      <Detail key="headline" label={t("headline")}>
        {user.headline}
      </Detail>
    ) : null,
    user.secondaryRoles.length === 0 ? null : (
      <Detail key="secondaryRoles" label={t("secondaryRoles")}>
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {user.secondaryRoles.map(role => (
            <li key={role.id}>
              <RoleFormatContent role={role} />
            </li>
          ))}
        </ul>
      </Detail>
    ),
  ].filter(detail => detail !== null);

  return (
    <section className="border-border flex flex-col gap-5 rounded-xl border p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-foreground text-base font-bold">
          {t("personalTitle")}
        </h3>

        {canEdit ? (
          <Dialog>
            <DialogTrigger
              render={<Button size="sm" variant="outline" />}
              type="button"
            >
              <PencilIcon />
              {t("edit")}
            </DialogTrigger>

            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{t("personalTitle")}</DialogTitle>
                <DialogDescription>{t("personalDialogDesc")}</DialogDescription>
              </DialogHeader>

              <React.Suspense fallback={<PersonalFormSkeleton />}>
                <PersonalFormContent
                  fields={fields}
                  onUpdate={onUpdate}
                  user={user}
                />
              </React.Suspense>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      <dl className="grid gap-4 sm:grid-cols-2 sm:gap-x-6">{details}</dl>
    </section>
  );
};
