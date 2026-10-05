import { IdCardIcon, PencilIcon, SlidersHorizontalIcon } from "lucide-react";
import React from "react";
import { useFormatter, useTranslations } from "use-intl";

import { useLanguages } from "@/components/languages-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { TooltipWithContent } from "@/components/ui/tooltip";
import { timeZoneLabel } from "@/views/auth/settings/overview/time-zone-update";

import type { UpdateAdminUser } from "./user-fields-content";
import type { AdminUserDetail } from "./user-query";

import { EditSheetContent } from "./edit-sheet-content";

const PersonalForm = React.lazy(async () =>
  import("./user-profile-forms").then(module => ({
    default: module.PersonalForm,
  })),
);

const PreferencesForm = React.lazy(async () =>
  import("./user-profile-forms").then(module => ({
    default: module.PreferencesForm,
  })),
);

export const DetailRow = ({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) => (
  <div className="flex items-baseline justify-between gap-4 py-2.5">
    <dt className="text-muted-foreground shrink-0 text-sm">{label}</dt>
    <dd className="text-foreground min-w-0 truncate text-end text-sm">
      {children}
    </dd>
  </div>
);

export const DetailCardTitle = ({
  children,
  icon: Icon,
}: {
  children: React.ReactNode;
  icon: React.ElementType<{ className?: string }>;
}) => (
  <CardTitle className="flex items-center gap-2">
    <Icon className="text-muted-foreground size-5" />
    {children}
  </CardTitle>
);

const EditGroupDialog = ({
  children,
  description,
  label,
  title,
}: {
  children: React.ReactNode;
  description: string;
  label: string;
  title: string;
}) => (
  <Dialog>
    <TooltipWithContent text={label}>
      <DialogTrigger
        render={<Button aria-label={label} size="icon-sm" variant="ghost" />}
      >
        <PencilIcon />
      </DialogTrigger>
    </TooltipWithContent>
    <EditSheetContent description={description} title={title}>
      {children}
    </EditSheetContent>
  </Dialog>
);

export const UserPersonalCard = ({
  canEdit,
  onUpdate,
  user,
}: {
  canEdit: boolean;
  onUpdate: UpdateAdminUser;
  user: AdminUserDetail;
}) => {
  const t = useTranslations("admin.user.show.personal");
  const format = useFormatter();
  const realName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  const notSet = <span className="text-muted-foreground">{t("notSet")}</span>;

  return (
    <Card className="w-full">
      <CardHeader>
        <DetailCardTitle icon={IdCardIcon}>{t("title")}</DetailCardTitle>
        {canEdit && (
          <CardAction>
            <EditGroupDialog
              description={t("editDesc")}
              label={t("edit")}
              title={t("title")}
            >
              <PersonalForm onUpdate={onUpdate} user={user} />
            </EditGroupDialog>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        <dl className="divide-border -my-2.5 flex flex-col divide-y">
          <DetailRow label={t("memberId")}>
            <span className="tabular-nums">#{user.id}</span>
          </DetailRow>
          <DetailRow label={t("realName")}>
            {realName ? (
              <>
                {realName}
                {!user.showRealName && (
                  <span className="text-muted-foreground">
                    {" "}
                    · {t("hidden")}
                  </span>
                )}
              </>
            ) : (
              notSet
            )}
          </DetailRow>
          <DetailRow label={t("headline")}>{user.headline ?? notSet}</DetailRow>
          <DetailRow label={t("phone")}>
            {user.phone ? (
              <span className="tabular-nums">{user.phone}</span>
            ) : (
              notSet
            )}
          </DetailRow>
          <DetailRow label={t("birthday")}>
            {user.birthday
              ? format.dateTime(new Date(user.birthday), {
                  dateStyle: "long",
                  timeZone: "UTC",
                })
              : notSet}
          </DetailRow>
        </dl>
      </CardContent>
    </Card>
  );
};

export const UserPreferencesCard = ({
  canEdit,
  onUpdate,
  user,
}: {
  canEdit: boolean;
  onUpdate: UpdateAdminUser;
  user: AdminUserDetail;
}) => {
  const t = useTranslations("admin.user.show.preferences");
  const languages = useLanguages();
  const language =
    languages.find(item => item.code === user.language)?.name ?? user.language;

  return (
    <Card className="w-full">
      <CardHeader>
        <DetailCardTitle icon={SlidersHorizontalIcon}>
          {t("title")}
        </DetailCardTitle>
        {canEdit && (
          <CardAction>
            <EditGroupDialog
              description={t("editDesc")}
              label={t("edit")}
              title={t("title")}
            >
              <PreferencesForm onUpdate={onUpdate} user={user} />
            </EditGroupDialog>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        <dl className="divide-border -my-2.5 flex flex-col divide-y">
          <DetailRow label={t("language")}>{language}</DetailRow>
          <DetailRow label={t("timeZone")}>
            {user.timeZone ? (
              timeZoneLabel(user.timeZone)
            ) : (
              <span className="text-muted-foreground">{t("timeZoneAuto")}</span>
            )}
          </DetailRow>
          <DetailRow label={t("newsletter")}>
            {user.newsletter ? t("subscribed") : t("notSubscribed")}
          </DetailRow>
        </dl>
      </CardContent>
    </Card>
  );
};
