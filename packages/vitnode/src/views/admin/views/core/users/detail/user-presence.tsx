import { useQuery } from "@tanstack/react-query";
import { ActivityIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import type { UserPresence } from "@/lib/user-presence";
import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";

import { DateFormat } from "@/components/date-format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UserPresenceStatus } from "@/components/user-presence-status";

import { adminUserPresenceQueryOptions } from "./user-presence-query";
import { DetailCardTitle, DetailRow } from "./user-profile-cards";

export const UserPresenceCardContent = ({
  presence,
}: {
  presence: UserPresence;
}) => {
  const t = useTranslations("admin.user.show.presence");

  if (presence.status === "hidden") {
    return (
      <dl className="divide-border -my-2.5 flex flex-col divide-y">
        <DetailRow label={t("status")}>
          <UserPresenceStatus presence={presence} />
        </DetailRow>
        <DetailRow label={t("visibility")}>
          <span className="text-muted-foreground text-pretty whitespace-normal">
            {t("unknown")}
          </span>
        </DetailRow>
      </dl>
    );
  }

  return (
    <dl className="divide-border -my-2.5 flex flex-col divide-y">
      <DetailRow label={t("status")}>
        <UserPresenceStatus presence={presence} />
      </DetailRow>
      <DetailRow label={t("lastActivity")}>
        {presence.lastSeenAt ? (
          <DateFormat date={presence.lastSeenAt} />
        ) : (
          <span className="text-muted-foreground">{t("never")}</span>
        )}
      </DetailRow>
      <DetailRow label={t("visibility")}>
        {presence.isHidden ? (
          <Badge variant="warning">
            <EyeOffIcon />
            {t("hiddenFromPublic")}
          </Badge>
        ) : (
          <Badge variant="secondary">
            <EyeIcon />
            {t("visible")}
          </Badge>
        )}
      </DetailRow>
    </dl>
  );
};

export const UserPresenceCard = ({
  adminUserId,
  userId,
}: {
  adminUserId: AdminIdentity;
  userId: number;
}) => {
  const t = useTranslations("admin.user.show.presence");
  const { data } = useQuery(
    adminUserPresenceQueryOptions({ adminUserId, userId }),
  );

  return (
    <Card>
      <CardHeader>
        <DetailCardTitle icon={ActivityIcon}>{t("title")}</DetailCardTitle>
      </CardHeader>
      <CardContent>
        {data ? (
          <UserPresenceCardContent presence={data} />
        ) : (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
          </div>
        )}
      </CardContent>
    </Card>
  );
};
