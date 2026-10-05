import { Link } from "@tanstack/react-router";
import {
  BadgeCheckIcon,
  ExternalLinkIcon,
  MailWarningIcon,
  ShieldIcon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { VerifyAdminUserEmail } from "@/views/admin/views/core/users/list/users-table-content";

import { Avatar } from "@/components/avatar";
import { DateFormat } from "@/components/date-format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UserCoverImage } from "@/components/user-cover-image";

import type { UpdateAdminUser } from "./user-fields-content";
import type {
  RemoveAdminUserImage,
  UploadAdminUserImage,
} from "./user-images-content";
import type { AdminUserDetail } from "./user-query";

import {
  EditNameCodeContent,
  EditUserFieldContent,
} from "./user-fields-content";
import { AdminUserImageDialog } from "./user-images-content";

const VerifyEmailButton = ({
  onVerifyEmail,
  user,
}: {
  onVerifyEmail: VerifyAdminUserEmail;
  user: AdminUserDetail;
}) => {
  const t = useTranslations("admin.user.show.verify");
  const tError = useTranslations("core.global.errors");
  const [isPending, startTransition] = React.useTransition();

  return (
    <Button
      isLoading={isPending}
      onClick={() => {
        startTransition(async () => {
          const result = await onVerifyEmail(user.id);
          if (result.error) {
            toast.error(tError("title"), {
              description: tError("internal_server_error"),
            });

            return;
          }
          toast.success(t("success"), {
            description: t("successDesc", { name: user.name }),
          });
        });
      }}
      variant="outline"
    >
      {t("action")}
    </Button>
  );
};

export const UserIdentityCard = ({
  canEdit,
  onRemoveImage,
  onUpdate,
  onUploadImage,
  onVerifyEmail,
  user,
}: {
  canEdit: boolean;
  onRemoveImage: RemoveAdminUserImage;
  onUpdate: UpdateAdminUser;
  onUploadImage: UploadAdminUserImage;
  onVerifyEmail: VerifyAdminUserEmail;
  user: AdminUserDetail;
}) => {
  const t = useTranslations("admin.user.show");

  return (
    <Card className="w-full overflow-hidden pt-0">
      <div className="from-primary/30 to-primary/5 relative h-28 w-full bg-linear-to-br">
        <UserCoverImage url={user.coverUrl} />
        {user.coverUrl ? null : (
          <span className="sr-only">{t("coverPlaceholder")}</span>
        )}
        {canEdit && (
          <div className="absolute inset-e-3 top-3">
            <AdminUserImageDialog
              hasImage={user.coverUrl !== null}
              id={user.id}
              kind="cover"
              limit={user.imagePolicy.cover}
              onRemove={onRemoveImage}
              onUpload={onUploadImage}
            />
          </div>
        )}
      </div>

      <CardContent className="flex flex-col items-center gap-4 text-center">
        <div className="relative -mt-16">
          <Avatar
            className="border-card size-28 border-4"
            loading="eager"
            size={112}
            user={user}
          />
          {canEdit && (
            <div className="absolute inset-e-0 bottom-0">
              <AdminUserImageDialog
                hasImage={user.avatarUrl !== null}
                id={user.id}
                kind="avatar"
                limit={user.imagePolicy.avatar}
                onRemove={onRemoveImage}
                onUpload={onUploadImage}
              />
            </div>
          )}
        </div>

        <div className="flex w-full min-w-0 flex-col items-center gap-1">
          <EditUserFieldContent
            as="h2"
            canEdit={canEdit}
            field="name"
            id={user.id}
            label={t("editName")}
            onUpdate={onUpdate}
            value={user.name}
            valueClassName="text-foreground truncate text-2xl font-semibold"
          />
          <div className="flex min-w-0 items-center gap-1">
            <span className="text-muted-foreground truncate text-sm">
              @{user.nameCode}
            </span>
            {canEdit && (
              <EditNameCodeContent
                id={user.id}
                nameCode={user.nameCode}
                onUpdate={onUpdate}
              />
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-1.5 pt-1">
            {user.isStaff && (
              <Badge variant="secondary">
                <ShieldIcon />
                {t("badges.staff")}
              </Badge>
            )}
            {user.emailVerified ? (
              <Badge variant="success">
                <BadgeCheckIcon />
                {t("badges.verified")}
              </Badge>
            ) : (
              <Badge variant="warning">
                <MailWarningIcon />
                {t("badges.unverified")}
              </Badge>
            )}
          </div>
        </div>

        <div className="w-full text-start">
          <EditUserFieldContent
            canEdit={canEdit}
            field="email"
            id={user.id}
            label={t("editEmail")}
            onUpdate={onUpdate}
            type="email"
            value={user.email}
            valueClassName="text-foreground truncate text-sm"
          />
          <p className="text-muted-foreground text-sm">
            {t("joined")} <DateFormat date={user.createdAt} />
          </p>
        </div>

        <div className="flex w-full flex-col gap-2">
          {canEdit && !user.emailVerified && (
            <VerifyEmailButton onVerifyEmail={onVerifyEmail} user={user} />
          )}
          <Button
            className="w-full"
            nativeButton={false}
            render={<Link target="_blank" to={`/users/${user.nameCode}`} />}
            variant="outline"
          >
            {t("goToProfile")} <ExternalLinkIcon />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
