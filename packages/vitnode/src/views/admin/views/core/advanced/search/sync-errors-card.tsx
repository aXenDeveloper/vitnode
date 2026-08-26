import { TriangleAlertIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { DateFormat } from "@/components/date-format";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type { SearchSyncError } from "./sync-errors";

import { parseSearchSyncError } from "./sync-errors";

export const SyncErrorsCard = async ({
  errors,
  labels,
}: {
  errors: SearchSyncError[];
  labels?: Map<string, string>;
}) => {
  if (errors.length === 0) return null;

  const t = await getTranslations("core.search.admin.syncErrors");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TriangleAlertIcon
            aria-hidden
            className="text-destructive size-4 shrink-0"
          />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("desc")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3">
          {errors.map(error => {
            const parsed = parseSearchSyncError(error.content);
            const collection = parsed.contentTypeId
              ? (labels?.get(parsed.contentTypeId) ?? parsed.contentTypeId)
              : error.pluginId;

            return (
              <li
                className="border-border flex flex-col gap-1 border-b pb-3 last:border-b-0 last:pb-0"
                key={error.id}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-foreground text-sm font-medium">
                    {collection}
                    {parsed.operation ? (
                      <span className="text-muted-foreground font-normal">
                        {" "}
                        · {parsed.operation}
                        {parsed.documentId ? ` · ${parsed.documentId}` : ""}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    <DateFormat date={error.createdAt} />
                  </span>
                </div>
                <p className="text-muted-foreground text-sm break-words">
                  {parsed.message ?? error.content}
                </p>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
};
