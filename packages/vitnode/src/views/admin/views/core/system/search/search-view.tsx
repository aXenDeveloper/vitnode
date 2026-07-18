import { getTranslations } from "next-intl/server";

import { debugAdminModule } from "@/api/modules/admin/debug/debug.admin.module";
import { DateFormat } from "@/components/date-format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetcher } from "@/lib/fetcher";
import { getSearchTypeRenderer } from "@/views/search/registry";

import { RebuildSearchAction } from "./rebuild-action";

const getStatus = async () => {
  const res = await fetcher(debugAdminModule, {
    prefixPath: "/admin",
    path: "/search/status",
    method: "get",
    module: "debug",
  });

  return res.json();
};

export const SearchAdminView = async () => {
  const [t, data] = await Promise.all([
    getTranslations("core.search"),
    getStatus(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.engine")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Badge className="uppercase">{data.engine}</Badge>
          <Badge variant={data.healthy ? "default" : "destructive"}>
            {t(data.healthy ? "admin.healthy" : "admin.unhealthy")}
          </Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.total")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold">{data.total}</span>
            <span className="text-muted-foreground text-sm">
              {t("admin.lastIndexed")}:{" "}
              {data.lastIndexedAt ? (
                <DateFormat date={data.lastIndexedAt} />
              ) : (
                t("admin.never")
              )}
            </span>
          </div>

          {data.types.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-sm font-medium">
                {t("admin.byType")}
              </span>
              <div className="flex flex-wrap gap-2">
                {data.types.map(type => (
                  <Badge key={type.itemType} variant="secondary">
                    {t(getSearchTypeRenderer(type.itemType).labelKey)}:{" "}
                    {type.count}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        <RebuildSearchAction />
        <p className="text-muted-foreground text-sm">{t("admin.cronWarning")}</p>
      </div>
    </div>
  );
};

export const SearchAdminViewSkeleton = () => (
  <div className="flex flex-col gap-4">
    <Skeleton className="h-28 w-full rounded-xl" />
    <Skeleton className="h-40 w-full rounded-xl" />
  </div>
);
