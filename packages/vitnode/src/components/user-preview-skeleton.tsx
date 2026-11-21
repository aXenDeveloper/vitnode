import { useTranslations } from "use-intl";

import { Skeleton } from "./ui/skeleton";

/** The user preview card's loading state, shaped like the loaded card. */
export const UserPreviewSkeleton = () => {
  const t = useTranslations("core.global");

  return (
    <div aria-busy="true" className="flex flex-col">
      <span className="sr-only" role="status">
        {t("loading")}
      </span>
      <div className="flex flex-col gap-3 px-4 pt-14 pb-4">
        <Skeleton className="size-14 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-3/5" />
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 border-t px-4 py-3">
        <Skeleton className="h-11" />
        <Skeleton className="h-11" />
        <Skeleton className="h-11" />
      </div>
      <div className="border-t p-4">
        <Skeleton className="h-8" />
      </div>
    </div>
  );
};
