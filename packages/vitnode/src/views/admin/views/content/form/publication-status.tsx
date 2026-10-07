import { CircleCheckIcon, FileClockIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { DateFormat } from "@/components/date-format";
import { Badge } from "@/components/ui/badge";
import { isContentPublished } from "@/content/publication";

import { ContentHiddenBadge } from "../lib/hidden-badge";

export const ContentFormPublication = ({
  hiddenAt,
  publishedAt,
  status,
}: {
  /** The record's `hiddenAt`, for a content type with visibility enabled. */
  hiddenAt?: unknown;
  publishedAt: unknown;
  status: unknown;
}) => {
  const t = useTranslations("core.content.status");
  const tVisibility = useTranslations("core.content.visibility");
  const published = isContentPublished(status);
  const date = typeof publishedAt === "string" ? new Date(publishedAt) : null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">{t("label")}</span>
      <Badge variant={published ? "default" : "secondary"}>
        {published ? (
          <CircleCheckIcon aria-hidden />
        ) : (
          <FileClockIcon aria-hidden />
        )}
        {published ? t("published") : t("draft")}
      </Badge>
      <ContentHiddenBadge label={tVisibility("hidden")} row={{ hiddenAt }} />
      <span className="text-muted-foreground">
        {date ? <DateFormat date={date} /> : t("never_published")}
      </span>
    </div>
  );
};
