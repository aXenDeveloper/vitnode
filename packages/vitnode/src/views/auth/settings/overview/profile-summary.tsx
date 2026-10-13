import {
  EyeIcon,
  EyeOffIcon,
  GlobeIcon,
  PhoneIcon,
  QuoteIcon,
  UserRoundIcon,
} from "lucide-react";
import { useTranslations } from "use-intl";

import type {
  PersonalInformationFields,
  UserPersonalInformation,
} from "@/lib/user-personal-information";
import type { ProfileRole } from "@/views/profile/profile-query";

import { Badge } from "@/components/ui/badge";
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/ui/frame";
import { fullNameOf } from "@/lib/user-personal-information";

import { OverviewFact } from "./overview-fact";
import { timeZoneLabel } from "./time-zone-update";

export interface ProfileSummaryUser extends UserPersonalInformation {
  email: string;
  emailVerified: boolean;
  name: string;
  secondaryRoles: ProfileRole[];
  timeZone: null | string;
}

export const ProfileSummary = ({
  canEdit,
  fields,
  user,
}: {
  canEdit: boolean;
  fields: PersonalInformationFields;
  user: ProfileSummaryUser;
}) => {
  const t = useTranslations("core.auth.settings.overview");

  return (
    <Frame>
      <FrameHeader>
        <FrameTitle render={<h2 />}>{t("personalTitle")}</FrameTitle>
        {canEdit ? (
          <FrameDescription>{t("personalDesc")}</FrameDescription>
        ) : null}
      </FrameHeader>
      <FramePanel render={<ul />}>
        {fields.firstName || fields.lastName ? (
          <OverviewFact
            icon={UserRoundIcon}
            label={t("name")}
            value={fullNameOf({
              firstName: fields.firstName ? user.firstName : null,
              lastName: fields.lastName ? user.lastName : null,
            })}
          />
        ) : null}
        {fields.headline && !user.headline ? (
          <OverviewFact icon={QuoteIcon} label={t("headline")} value={null} />
        ) : null}
        {fields.phone ? (
          <OverviewFact
            icon={PhoneIcon}
            label={t("phone")}
            value={user.phone}
          />
        ) : null}
        <OverviewFact
          badge={
            user.timeZone ? null : (
              <Badge variant="outline">{t("timeZoneAutoBadge")}</Badge>
            )
          }
          icon={GlobeIcon}
          label={t("timeZone")}
          value={
            user.timeZone ? timeZoneLabel(user.timeZone) : t("timeZoneAuto")
          }
        />
        {fields.showRealName ? (
          <OverviewFact
            icon={user.showRealName ? EyeIcon : EyeOffIcon}
            label={t("realName")}
            value={user.showRealName ? t("realNameShown") : t("realNameHidden")}
          />
        ) : null}
      </FramePanel>
    </Frame>
  );
};
