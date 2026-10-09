import { cn } from "cn";
import { useTranslations } from "use-intl";

import type {
  PersonalInformationFields,
  UserPersonalInformation,
} from "@/lib/user-personal-information";
import type { ProfileRole } from "@/views/profile/profile-query";

import { fullNameOf } from "@/lib/user-personal-information";

import { SETTINGS_ROW, SETTINGS_ROW_LABEL } from "../settings-group";
import { timeZoneLabel } from "./time-zone-update";

export interface ProfileSummaryUser extends UserPersonalInformation {
  email: string;
  emailVerified: boolean;
  name: string;
  secondaryRoles: ProfileRole[];
  timeZone: null | string;
}

const SummaryRow = ({
  label,
  value,
}: {
  label: string;
  value: null | string;
}) => {
  const t = useTranslations("core.auth.settings.overview");

  return (
    <li className={SETTINGS_ROW}>
      <span className={SETTINGS_ROW_LABEL}>{label}</span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-end text-sm",
          value ? "text-muted-foreground" : "text-muted-foreground/70",
        )}
      >
        {value ?? t("notSet")}
      </span>
    </li>
  );
};

export const ProfileSummary = ({
  fields,
  user,
}: {
  fields: PersonalInformationFields;
  user: ProfileSummaryUser;
}) => {
  const t = useTranslations("core.auth.settings.overview");

  return (
    <>
      {fields.headline && user.headline ? (
        <li className={SETTINGS_ROW}>
          <p className="text-foreground text-sm leading-relaxed text-pretty wrap-anywhere">
            {user.headline}
          </p>
        </li>
      ) : null}
      {fields.firstName || fields.lastName ? (
        <SummaryRow
          label={t("name")}
          value={fullNameOf({
            firstName: fields.firstName ? user.firstName : null,
            lastName: fields.lastName ? user.lastName : null,
          })}
        />
      ) : null}
      {fields.headline && !user.headline ? (
        <SummaryRow label={t("headline")} value={null} />
      ) : null}
      {fields.phone ? (
        <SummaryRow label={t("phone")} value={user.phone} />
      ) : null}
      <SummaryRow
        label={t("timeZone")}
        value={user.timeZone ? timeZoneLabel(user.timeZone) : t("timeZoneAuto")}
      />
      {fields.showRealName ? (
        <SummaryRow
          label={t("realName")}
          value={user.showRealName ? t("realNameShown") : t("realNameHidden")}
        />
      ) : null}
    </>
  );
};
