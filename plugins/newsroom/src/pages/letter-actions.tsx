import type { ContentPermissions } from "@vitnode/core/tanstack/content";

import { buttonVariants } from "@vitnode/core/components/ui/button";
import { contentTarget } from "@vitnode/core/content";
import { HrefLink } from "@vitnode/core/tanstack/link";
import { ReportButton } from "@vitnode/core/tanstack/moderation";
import { PencilIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { letterContentType } from "@/content/letter";
import { manifest } from "@/manifest.gen";

import { letterEditHref } from "./letter-search";

/** Edit and Report for one letter, as the Content Engine allows them. */
export const LetterActions = ({
  can,
  describedBy,
  id,
  size = "default",
  title,
}: {
  can: ContentPermissions;
  /** The id of the element that names the letter, for screen readers. */
  describedBy?: string;
  id: number;
  size?: "default" | "sm";
  title: string;
}) => {
  const t = useTranslations("newsroom.letters.detail");

  return (
    <div className="flex flex-wrap items-center gap-2">
      {can.canEdit ? (
        <HrefLink
          aria-describedby={describedBy}
          className={buttonVariants({ size, variant: "outline" })}
          href={letterEditHref(id)}
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
          target={contentTarget(manifest.id, letterContentType, id)}
          typeLabel={t("report_type")}
        />
      ) : null}
    </div>
  );
};
