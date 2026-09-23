import { cn } from "cn";
import { useTranslations } from "use-intl";

import type { PersonalInformationFields } from "@/lib/user-personal-information";
import type { UserImageEditor } from "@/views/profile/images/types";
import type { ProfileRole } from "@/views/profile/profile-query";

import { Avatar } from "@/components/avatar";
import { RoleFormatContent } from "@/components/role-format-content";
import { PageTitle } from "@/components/ui/page-title";
import { displayNameOf } from "@/lib/user-personal-information";
import { SelfUserImageDialog } from "@/views/profile/images/self-image-dialog";

import type { PersonalInformationUser } from "./personal-content";
import type { UpdatePersonalInformation } from "./personal-update";

import {
  SETTINGS_ROW,
  SETTINGS_ROW_LABEL,
  SettingsGroup,
} from "../settings-group";
import { PersonalInformationContent } from "./personal-content";
import { RealNameRow } from "./real-name-row";

export interface SettingsOverviewUser extends PersonalInformationUser {
  avatarColor: string;
  avatarUrl: null | string;
  name: string;
  nameCode: string;
  role: ProfileRole;
}

export const OverviewSettingsContent = ({
  canEditPersonalInfo,
  editor,
  personalFields,
  onUpdate,
  user,
}: {
  canEditPersonalInfo: boolean;
  editor?: UserImageEditor;
  onUpdate: UpdatePersonalInformation;
  personalFields: PersonalInformationFields;
  user: SettingsOverviewUser;
}) => {
  const t = useTranslations("core.auth.settings.overview");
  const tNav = useTranslations("core.auth.settings.nav");
  const tSettings = useTranslations("core.auth.settings");
  const displayName = displayNameOf({
    ...user,
    showRealName: personalFields.showRealName && user.showRealName,
  });

  return (
    <>
      <PageTitle
        className="mb-0"
        desc={t("desc")}
        h1={tNav("overview")}
        subtitle={tSettings("title")}
      />

      <SettingsGroup title={t("profileTitle")}>
        <li className={SETTINGS_ROW}>
          <Avatar
            className="size-12 shrink-0"
            loading="eager"
            size={48}
            user={{ ...user, name: displayName }}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-foreground font-semibold text-pretty wrap-anywhere">
              {displayName}
            </span>
            <span className="text-muted-foreground truncate text-sm">
              @{user.nameCode}
            </span>
          </div>
          {editor ? (
            <SelfUserImageDialog
              editor={editor}
              hasImage={user.avatarUrl !== null}
              kind="avatar"
              size="icon-sm"
            />
          ) : null}
        </li>

        {personalFields.showRealName ? (
          <RealNameRow
            canEdit={canEditPersonalInfo}
            checked={user.showRealName}
            onUpdate={onUpdate}
          />
        ) : null}
      </SettingsGroup>

      <PersonalInformationContent
        canEdit={canEditPersonalInfo}
        fields={personalFields}
        onUpdate={onUpdate}
        user={user}
      />

      <SettingsGroup title={t("accountTitle")}>
        <li className={SETTINGS_ROW}>
          <span className={SETTINGS_ROW_LABEL}>{t("nickname")}</span>
          <span className="text-muted-foreground min-w-0 flex-1 truncate text-end text-sm">
            {user.name}
          </span>
        </li>
        <li className={SETTINGS_ROW}>
          <span className={SETTINGS_ROW_LABEL}>{t("email")}</span>
          <span className="text-muted-foreground min-w-0 flex-1 text-end text-sm wrap-anywhere">
            {user.email}
          </span>
        </li>
        <li className={SETTINGS_ROW}>
          <span className={SETTINGS_ROW_LABEL}>{t("role")}</span>
          <span className="flex min-w-0 flex-1 justify-end text-sm">
            <RoleFormatContent role={user.role} />
          </span>
        </li>
        {user.secondaryRoles.length === 0 ? null : (
          <li className={cn(SETTINGS_ROW, "items-start")}>
            <span className={SETTINGS_ROW_LABEL}>{t("secondaryRoles")}</span>
            <ul className="flex min-w-0 flex-1 flex-wrap justify-end gap-x-4 gap-y-1 text-sm">
              {user.secondaryRoles.map(role => (
                <li key={role.id}>
                  <RoleFormatContent role={role} />
                </li>
              ))}
            </ul>
          </li>
        )}
      </SettingsGroup>
    </>
  );
};
