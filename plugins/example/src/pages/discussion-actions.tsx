import type { ContentPermissions } from "@vitnode/core/tanstack/content";

import { buttonVariants } from "@vitnode/core/components/ui/button";
import { contentTarget } from "@vitnode/core/content";
import { HrefLink } from "@vitnode/core/tanstack/link";
import { ReportButton } from "@vitnode/core/tanstack/moderation";
import { PencilIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { discussionContentType } from "@/content/discussion";
import { manifest } from "@/manifest.gen";

import { discussionEditHref } from "./discussion-search";

/** Edit and Report for one discussion, as the Content Engine allows them. */
export const DiscussionActions = ({
  can,
  describedBy,
  id,
  size = "default",
  title,
}: {
  can: ContentPermissions;
  /** The id of the element that names the discussion, for screen readers. */
  describedBy?: string;
  id: number;
  size?: "default" | "sm";
  title: string;
}) => {
  const t = useTranslations("@vitnode/example.discussions.detail");

  return (
    <div className="flex flex-wrap items-center gap-2">
      {can.canEdit ? (
        <HrefLink
          aria-describedby={describedBy}
          className={buttonVariants({ size, variant: "outline" })}
          href={discussionEditHref(id)}
        >
          <PencilIcon aria-hidden="true" />
          {t("edit")}
        </HrefLink>
      ) : null}
      {can.canReport ? (
        <ReportButton
          className="text-muted-foreground"
          describedBy={describedBy}
          preview={{ title }}
          target={contentTarget(manifest.id, discussionContentType, id)}
          typeLabel={t("report_type")}
        />
      ) : null}
    </div>
  );
};
