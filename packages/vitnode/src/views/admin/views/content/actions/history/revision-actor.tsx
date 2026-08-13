// No "use client": reached only from client entries - the history panel and the
// translation manager inside the edit form.
import { useTranslations } from "next-intl";

import type { ContentRevisionMeta } from "@/content/revisions";

import { UserFormat } from "@/components/user-format";
import { Link } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/**
 * Who made the change, and a way to go and ask them.
 *
 * The link needs both halves: the id says there was an account, and the name
 * says it still exists - a revision whose author has since been deleted keeps
 * its `actorUserId` and joins to nothing, and a link to a user page that no
 * longer resolves is worse than plain text.
 *
 * Shared by both histories, because a name that is clickable in one of them and
 * plain in the other reads as a bug.
 */
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
