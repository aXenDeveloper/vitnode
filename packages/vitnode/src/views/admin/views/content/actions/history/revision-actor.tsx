// No "use client": reached only from client entries - the history panel and the
// translation manager inside the edit form.
import { useTranslations } from "next-intl";

import type { ContentRevisionMeta } from "@/content/revisions";

import { UserFormat } from "@/components/user-format";
import { Link } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export const RevisionActor = ({
  className,
  revision,
}: {
  className?: string;
  revision: Pick<
    ContentRevisionMeta,
    "actorName" | "actorRoleColor" | "actorUserId"
  >;
}) => {
  const t = useTranslations("core.content.history");

  if (revision.actorUserId === null || revision.actorName === null) {
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
      href={`/admin/core/users/${revision.actorUserId}`}
    >
      <UserFormat
        format
        user={{
          name: revision.actorName,
          role: { color: revision.actorRoleColor },
        }}
      />
    </Link>
  );
};
