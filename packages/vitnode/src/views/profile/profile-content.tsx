import type { LucideIcon } from "lucide-react";

import { cn } from "cn";
import {
  BriefcaseBusinessIcon,
  CalendarDaysIcon,
  SparklesIcon,
} from "lucide-react";
import { useFormatter, useTranslations } from "use-intl";

import { Avatar } from "@/components/avatar";
import { RoleFormatContent } from "@/components/role-format-content";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCoverImage } from "@/components/user-cover-image";

import type { UserImageEditor } from "./images/types";
import type { ProfileRole, UserProfile } from "./profile-query";

import { userCoverStyle } from "./images/cover-style";
import { SelfUserImageDialog } from "./images/self-image-dialog";

const MetaItem = ({
  children,
  Icon,
  label,
}: {
  children: React.ReactNode;
  Icon?: LucideIcon;
  label: string;
}) => (
  <li className="flex min-w-0 items-center gap-2">
    {Icon ? <Icon aria-hidden="true" className="size-4 shrink-0" /> : null}
    <span className="sr-only">{label}</span>
    {children}
  </li>
);

const SecondaryRoles = ({ roles }: { roles: ProfileRole[] }) => {
  const t = useTranslations("core.profile");

  if (roles.length === 0) return null;

  return (
    <Card className="h-fit lg:col-span-1">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
            <SparklesIcon aria-hidden="true" className="size-5" />
          </span>
          {t("about")}
        </CardTitle>
      </CardHeader>

      <CardContent>
        <dl className="flex flex-col gap-1.5">
          <dt className="text-muted-foreground text-sm">
            {t("secondaryRoles")}
          </dt>
          <dd>
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {roles.map(role => (
                <li key={role.id}>
                  <RoleFormatContent role={role} />
                </li>
              ))}
            </ul>
          </dd>
        </dl>
      </CardContent>
    </Card>
  );
};

export interface ProfileContentProps {
  action?: React.ReactNode;
  /** Rendered beside the About card on large screens - a feed, posts, anything the host adds. */
  children?: React.ReactNode;
  editor?: UserImageEditor;
  user: UserProfile;
}

export const ProfileContent = ({
  action,
  children,
  editor,
  user,
}: ProfileContentProps) => {
  const t = useTranslations("core.profile");
  const format = useFormatter();
  const joinedAt = new Date(user.createdAt);
  const joinedLabel = format.dateTime(joinedAt, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const joinedIso = joinedAt.toISOString();
  const hasAside = user.secondaryRoles.length > 0;

  return (
    <div className="container mx-auto flex flex-col gap-4 p-4 sm:gap-6">
      <Card className="gap-0 pt-0">
        <div
          className="bg-muted relative h-32 w-full sm:h-40 md:h-48"
          data-slot="profile-cover"
          style={userCoverStyle(user.avatarColor)}
        >
          <UserCoverImage fetchPriority="high" url={user.coverUrl} />

          {editor ? (
            <div className="absolute inset-e-3 top-3">
              <SelfUserImageDialog
                editor={editor}
                hasImage={user.coverUrl !== null}
                kind="cover"
              />
            </div>
          ) : null}
        </div>

        <CardContent className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-end sm:gap-5 sm:text-start">
          <div className="relative -mt-8 shrink-0">
            <Avatar
              className="border-card size-24 rounded-full border-4 sm:size-28"
              loading="eager"
              size={112}
              user={user}
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

          <div className="flex min-w-0 flex-1 flex-col items-center gap-2 sm:items-start sm:pb-1">
            <div className="flex max-w-full min-w-0 flex-wrap items-baseline justify-center gap-x-3 sm:justify-start">
              <h1 className="text-foreground truncate text-2xl font-bold">
                {user.name}
              </h1>
              <p className="text-muted-foreground truncate text-sm">
                @{user.nameCode}
              </p>
            </div>

            <ul className="text-muted-foreground flex max-w-full flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-sm sm:justify-start">
              <MetaItem label={t("role")}>
                <RoleFormatContent role={user.role} />
              </MetaItem>

              {user.headline ? (
                <MetaItem Icon={BriefcaseBusinessIcon} label={t("headline")}>
                  <span className="truncate">{user.headline}</span>
                </MetaItem>
              ) : null}

              <MetaItem Icon={CalendarDaysIcon} label={t("memberSince")}>
                <time dateTime={joinedIso}>{joinedLabel}</time>
              </MetaItem>
            </ul>
          </div>

          {action ? (
            <div className="flex w-full flex-col sm:ms-auto sm:w-auto sm:pb-1">
              {action}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {hasAside || children ? (
        <div
          className={cn(
            "grid gap-4 sm:gap-6",
            hasAside && children ? "lg:grid-cols-3" : null,
          )}
        >
          <SecondaryRoles roles={user.secondaryRoles} />

          {children ? (
            <div
              className={cn(
                "flex flex-col gap-4 sm:gap-6",
                hasAside ? "lg:col-span-2" : null,
              )}
            >
              {children}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
