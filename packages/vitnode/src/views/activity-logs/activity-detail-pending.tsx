import { useTranslations } from "use-intl";

import { Skeleton } from "@/components/ui/skeleton";

/** Shaped like the facts and the first change it stands in for. */
export const ActivityDetailPending = () => {
  const t = useTranslations("core.activity_logs.detail");

  return (
    <div aria-busy className="flex flex-col gap-6">
      <span className="sr-only" role="status">
        {t("loading")}
      </span>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {["actor", "date", "area", "plugin"].map(key => (
          <div className="flex flex-col gap-2" key={key}>
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-32" />
          </div>
        ))}
      </div>
      <Skeleton className="h-24 w-full rounded-lg" />
    </div>
  );
};
