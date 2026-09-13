import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { useTranslations } from "use-intl";

import type { ContentRevisionMeta } from "@/content/revisions";

import { UserFormat } from "@/components/user-format";

type RevisionActorMeta = Pick<
  ContentRevisionMeta,
  "actorName" | "actorRoleColor" | "actorRolePrefix" | "actorUserId"
>;

export const RevisionActor = ({
  className,
  revision,
}: {
  className?: string;
  revision: RevisionActorMeta;
}) => {
  const t = useTranslations("core.content.history");
  const { actorName, actorRoleColor, actorRolePrefix, actorUserId } = revision;

  if (actorUserId === null || actorName === null) {
    return (
      <span className={cn("truncate", className)}>{t("system_actor")}</span>
    );
  }

  return (
    <Link
      className={cn(
        "hover:text-foreground truncate underline-offset-3 hover:underline",
        className,
      )}
      to={`/admin/core/users/${actorUserId}`}
    >
      <UserFormat
        format
        user={{
          name: actorName,
          role: { color: actorRoleColor, prefix: actorRolePrefix },
        }}
      />
    </Link>
  );
};
