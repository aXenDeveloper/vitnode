import { cn } from "cn";
import { ChevronRightIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import type {
  PersonalInformationFields,
  UserPersonalInformation,
  UserPersonalInformationTextField,
} from "@/lib/user-personal-information";
import type { ProfileRole } from "@/views/profile/profile-query";

import { Skeleton } from "@/components/ui/skeleton";
import { PERSONAL_INFORMATION_TEXT_FIELDS } from "@/lib/user-personal-information";

import type { UpdatePersonalInformation } from "./personal-update";

import {
  SETTINGS_INTERACTIVE_ROW,
  SETTINGS_ROW,
  SETTINGS_ROW_LABEL,
  SettingsGroup,
} from "../settings-group";

const PersonalFieldEditor = React.lazy(async () =>
  import("./personal-field-editor").then(module => ({
    default: module.PersonalFieldEditor,
  })),
);

const PersonalFieldEditorSkeleton = () => (
  <div aria-hidden="true" className="flex flex-col gap-3 px-4 py-4">
    <Skeleton className="h-14 w-full rounded-md" />
    <div className="flex justify-end gap-2">
      <Skeleton className="h-9 w-20 rounded-md" />
      <Skeleton className="h-9 w-28 rounded-md" />
    </div>
  </div>
);

const STACKED_FIELDS: readonly UserPersonalInformationTextField[] = [
  "headline",
];

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
  const [editing, setEditing] =
    React.useState<null | UserPersonalInformationTextField>(null);
  const rowsRef = React.useRef(
    new Map<UserPersonalInformationTextField, HTMLButtonElement>(),
  );
  const visibleFields = PERSONAL_INFORMATION_TEXT_FIELDS.filter(
    field => fields[field],
  );

  if (visibleFields.length === 0) return null;

  const closeEditor = (field: UserPersonalInformationTextField) => {
    setEditing(null);
    requestAnimationFrame(() => rowsRef.current.get(field)?.focus());
  };

  return (
    <SettingsGroup
      footer={canEdit ? t("personalDesc") : undefined}
      title={t("personalTitle")}
    >
      {visibleFields.map(field => {
        const value = user[field];
        const isStacked = STACKED_FIELDS.includes(field);

        if (editing === field) {
          return (
            <li key={field}>
              <React.Suspense fallback={<PersonalFieldEditorSkeleton />}>
                <PersonalFieldEditor
                  field={field}
                  onClose={() => {
                    closeEditor(field);
                  }}
                  onUpdate={onUpdate}
                  value={value}
                />
              </React.Suspense>
            </li>
          );
        }

        const details = (
          <span
            className={cn(
              "flex min-w-0 flex-1 gap-3",
              isStacked ? "flex-col gap-1" : "items-center",
            )}
          >
            <span className={SETTINGS_ROW_LABEL}>{t(field)}</span>
            <span
              className={cn(
                "text-muted-foreground min-w-0 flex-1 text-sm",
                isStacked
                  ? "leading-relaxed text-pretty wrap-anywhere"
                  : "truncate text-end",
              )}
            >
              {value ?? t("notSet")}
            </span>
          </span>
        );

        return (
          <li key={field}>
            {canEdit ? (
              <button
                className={cn(
                  SETTINGS_INTERACTIVE_ROW,
                  isStacked && "items-start",
                )}
                onClick={() => {
                  setEditing(field);
                }}
                ref={node => {
                  if (node) rowsRef.current.set(field, node);
                }}
                type="button"
              >
                {details}
                <span className="sr-only">{t("edit")}</span>
                <ChevronRightIcon
                  aria-hidden="true"
                  className="text-muted-foreground size-4 shrink-0 rtl:rotate-180"
                />
              </button>
            ) : (
              <div className={cn(SETTINGS_ROW, isStacked && "items-start")}>
                {details}
              </div>
            )}
          </li>
        );
      })}
    </SettingsGroup>
  );
};
