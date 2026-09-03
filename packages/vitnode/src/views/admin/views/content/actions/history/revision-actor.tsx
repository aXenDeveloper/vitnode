// No "use client": reached only from client entries - the history panel and
// anything else that renders a revision.
import { useTranslations } from "use-intl";

import type { ContentRevisionMeta } from "@/content/revisions";

import { UserFormat } from "@/components/user-format";
import { cn } from "@/lib/utils";

import type { ContentFormLinkComponent } from "../../form/context";

import { useContentFormNavigation } from "../../form/navigation";

type RevisionActorMeta = Pick<
  ContentRevisionMeta,
  "actorName" | "actorRoleColor" | "actorUserId"
>;

const RevisionActorLink = ({
  actorName,
  actorRoleColor,
  actorUserId,
  className,
  LinkComponent,
}: RevisionActorMeta & {
  actorName: string;
  actorUserId: number;
  className?: string;
  LinkComponent: ContentFormLinkComponent;
}) => (
  <LinkComponent
    className={cn(
      "hover:text-foreground truncate underline-offset-3 hover:underline",
      className,
    )}
    href={`/admin/core/users/${actorUserId}`}
  >
    <UserFormat
      format
      user={{ name: actorName, role: { color: actorRoleColor } }}
    />
  </LinkComponent>
);

export const RevisionActor = ({
  className,
  revision,
}: {
  className?: string;
  revision: RevisionActorMeta;
}) => {
  const t = useTranslations("core.content.history");
  const { LinkComponent } = useContentFormNavigation();

  if (revision.actorUserId === null || revision.actorName === null) {
    return (
      <span className={cn("truncate", className)}>{t("system_actor")}</span>
    );
  }

  return (
    <RevisionActorLink
      {...revision}
      actorName={revision.actorName}
      actorUserId={revision.actorUserId}
      className={className}
      LinkComponent={LinkComponent}
    />
  );
};
