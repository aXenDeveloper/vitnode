// No "use client": reached only from client entries - the history panel and
// anything else that renders a revision.
import { useTranslations } from "use-intl";

import type { ContentRevisionMeta } from "@/content/revisions";

import { UserFormat } from "@/components/user-format";
import { cn } from "@/lib/utils";

import type { ContentFormLinkComponent } from "../../form/context";

import { useContentFormNavigation } from "../../form/navigation";

/**
 * Who made a revision, as a link to their member page - or the word "system".
 *
 * A schedule firing, a cron run and a migration all write revisions with no
 * actor, and that is a real answer rather than a gap: `actorUserId === null`
 * means nobody was signed in, and saying so is the difference between "the
 * system unpublished this" and "we lost track of who did".
 *
 * The link component is the host's, read from the navigation seam rather than
 * imported: `@/lib/navigation` is `next-intl`'s router, which a TanStack Start
 * bundle cannot load at all.
 */

type RevisionActorMeta = Pick<
  ContentRevisionMeta,
  "actorName" | "actorRoleColor" | "actorUserId"
>;

/**
 * The link itself, taking the host's component as a **prop**.
 *
 * Module scope with the component passed in, rather than named inside the body
 * that reads it out of context - the arrangement `ContentFormCancel` and
 * `ContentRowPanelSlot` already use, and the shape `static-components` requires:
 * a component named in a render body would remount its subtree whenever the
 * value's identity changed.
 */
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
