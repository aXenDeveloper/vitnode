import { useTranslations } from "use-intl";

import type { PersonalInformationFields } from "@/lib/user-personal-information";
import type { UserImageEditor } from "@/views/profile/images/types";
import type { ProfileRole } from "@/views/profile/profile-query";

import { Avatar } from "@/components/avatar";
import { RoleFormatContent } from "@/components/role-format-content";
import { HeaderContent } from "@/components/ui/header-content";
import { displayNameOf } from "@/lib/user-personal-information";
import { SelfUserImageDialog } from "@/views/profile/images/self-image-dialog";

import type { PersonalInformationUser } from "./personal-content";
import type { UpdatePersonalInformation } from "./personal-update";

import { PersonalInformationContent } from "./personal-content";

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
  const displayName = displayNameOf({
    ...user,
    showRealName: personalFields.showRealName && user.showRealName,
  });

  return (
    <>
      <HeaderContent desc={t("desc")} h2={tNav("overview")} />

      <div className="flex flex-col gap-4 sm:gap-6">
        <section className="border-border flex flex-col items-center gap-4 rounded-xl border p-4 text-center sm:flex-row sm:p-5 sm:text-start">
          <div className="relative shrink-0">
            <Avatar
              className="size-20"
              loading="eager"
              size={80}
              user={{ ...user, name: displayName }}
            />

            {editor ? (
              <div className="absolute inset-e-0 bottom-0">
                <SelfUserImageDialog
                  editor={editor}
                  hasImage={user.avatarUrl !== null}
                  kind="avatar"
                />
              </div>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-baseline justify-center gap-x-2 sm:justify-start">
              <h3 className="text-foreground truncate text-lg font-bold">
                {displayName}
              </h3>
              <span className="text-muted-foreground truncate text-sm">
                @{user.nameCode}
              </span>
            </div>

            <RoleFormatContent className="text-sm" role={user.role} />
          </div>
        </section>

        <PersonalInformationContent
          canEdit={canEditPersonalInfo}
          fields={personalFields}
          onUpdate={onUpdate}
          user={user}
        />
      </div>
    </>
  );
};
