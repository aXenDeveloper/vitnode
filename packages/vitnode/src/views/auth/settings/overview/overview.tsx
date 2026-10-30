import { AtSignIcon, MailIcon, ShieldIcon, UsersIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import type { PersonalInformationFields } from "@/lib/user-personal-information";
import type { UserImageEditor } from "@/views/profile/images/types";
import type { ProfileRole } from "@/views/profile/profile-query";

import { Avatar } from "@/components/avatar";
import { RoleFormat } from "@/components/role-format";
import { Badge } from "@/components/ui/badge";
import {
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/ui/frame";
import { PageTitle } from "@/components/ui/page-title";
import { displayNameOf } from "@/lib/user-personal-information";
import { SelfUserImageDialog } from "@/views/profile/images/self-image-dialog";

import type { UpdatePersonalInformation } from "./personal-update";
import type { ProfileSummaryUser } from "./profile-summary";
import type { UpdateTimeZone } from "./time-zone-update";

import { OverviewFact } from "./overview-fact";
import { ProfileSheet } from "./profile-sheet";
import { ProfileSummary } from "./profile-summary";

export interface SettingsOverviewUser extends ProfileSummaryUser {
  avatarColor: string;
  avatarUrl: null | string;
  nameCode: string;
  role: ProfileRole;
}

export const OverviewSettingsContent = ({
  aiPoints,
  canEditPersonalInfo,
  editor,
  personalFields,
  onTimeZoneUpdate,
  onUpdate,
  privacy,
  user,
}: {
  aiPoints?: React.ReactNode;
  canEditPersonalInfo: boolean;
  editor?: UserImageEditor;
  onTimeZoneUpdate: UpdateTimeZone;
  onUpdate: UpdatePersonalInformation;
  personalFields: PersonalInformationFields;
  privacy?: React.ReactNode;
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

      <Frame>
        <FramePanel>
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <Avatar
                className="size-16 shrink-0"
                loading="eager"
                size={64}
                user={{ ...user, name: displayName }}
              />
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-foreground text-lg font-semibold text-balance wrap-anywhere">
                  {displayName}
                </p>
                <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-sm">
                  <span className="truncate">@{user.nameCode}</span>
                  <span aria-hidden>·</span>
                  <RoleFormat role={user.role} />
                </p>
                {personalFields.headline && user.headline ? (
                  <p className="text-foreground text-sm leading-relaxed text-pretty wrap-anywhere">
                    {user.headline}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {editor ? (
                <SelfUserImageDialog
                  editor={editor}
                  hasImage={user.avatarUrl !== null}
                  kind="avatar"
                  size="icon-sm"
                />
              ) : null}
              <ProfileSheet
                canEdit={canEditPersonalInfo}
                fields={personalFields}
                onTimeZoneUpdate={onTimeZoneUpdate}
                onUpdate={onUpdate}
                user={user}
              />
            </div>
          </div>
        </FramePanel>
      </Frame>

      <div className="grid gap-4 md:grid-cols-2">
        <ProfileSummary
          canEdit={canEditPersonalInfo}
          fields={personalFields}
          user={user}
        />

        <Frame>
          <FrameHeader>
            <FrameTitle render={<h2 />}>{t("accountTitle")}</FrameTitle>
          </FrameHeader>
          <FramePanel render={<ul />}>
            <OverviewFact
              icon={AtSignIcon}
              label={t("nickname")}
              value={user.name}
            />
            <OverviewFact
              badge={
                user.emailVerified ? (
                  <Badge variant="success">{t("emailVerified")}</Badge>
                ) : null
              }
              icon={MailIcon}
              label={t("email")}
              value={user.email}
            />
            <OverviewFact
              icon={ShieldIcon}
              label={t("role")}
              value={<RoleFormat role={user.role} />}
            />
            {user.secondaryRoles.length === 0 ? null : (
              <OverviewFact
                icon={UsersIcon}
                label={t("secondaryRoles")}
                value={
                  <span className="flex flex-wrap gap-x-3 gap-y-1">
                    {user.secondaryRoles.map(role => (
                      <RoleFormat key={role.id} role={role} />
                    ))}
                  </span>
                }
              />
            )}
          </FramePanel>
        </Frame>
      </div>

      {privacy}

      {aiPoints}
    </>
  );
};
