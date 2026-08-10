// No "use client": reached only from `content-form` / a layout, both of which
// are already inside a client entry.
import { CircleCheckIcon, FileClockIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { DateFormat } from "@/components/date-format";
import { Badge } from "@/components/ui/badge";

/**
 * A read-only line saying where the record is in the lifecycle.
 *
 * Read-only on purpose, and the rule is the same in a dialog and on a page:
 * `status` and `publishedAt` are not in the form schema, and the one thing that
 * moves them is the publish action on the list. Two competing mutation paths in
 * one form is how a form ends up fighting its own optimistic state.
 */
export const ContentFormPublication = ({
  publishedAt,
  status,
}: {
  publishedAt: unknown;
  status: unknown;
}) => {
  const t = useTranslations("core.content.status");
  const published = status === "published";
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
      <span className="text-muted-foreground">
        {date ? <DateFormat date={date} /> : t("never_published")}
      </span>
    </div>
  );
};
