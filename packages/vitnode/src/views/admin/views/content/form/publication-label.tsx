import { cn } from "cn";
import { useFormatter, useTranslations } from "use-intl";

import { TooltipWithContent } from "@/components/ui/tooltip";
import { isContentPublished } from "@/content/publication";

import { useContentForm } from "./context";

export const ContentFormPublicationLabel = ({
  className,
}: {
  className?: string;
}) => {
  const t = useTranslations("core.content.status");
  const format = useFormatter();
  const { mode, publication, skeleton } = useContentForm();

  if (!publication.enabled || mode === "create" || skeleton) return null;

  const published = isContentPublished(publication.status);
  const publishedAt =
    typeof publication.publishedAt === "string"
      ? new Date(publication.publishedAt)
      : null;

  return (
    <TooltipWithContent
      text={
        publishedAt && !Number.isNaN(publishedAt.getTime())
          ? t("published_on", {
              date: format.dateTime(publishedAt, {
                dateStyle: "medium",
                timeStyle: "short",
              }),
            })
          : t("never_published")
      }
    >
      <span
        className={cn(
          "text-muted-foreground focus-visible:ring-ring/50 inline-flex items-center gap-1.5 rounded-sm text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-3",
          className,
        )}
        tabIndex={0}
      >
        <span
          aria-hidden
          className={cn(
            "size-2 shrink-0 rounded-full",
            published ? "bg-success" : "bg-warn",
          )}
        />
        {published ? t("published") : t("draft")}
      </span>
    </TooltipWithContent>
  );
};
