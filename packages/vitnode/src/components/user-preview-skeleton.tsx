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
      <Skeleton className="h-20 w-full rounded-none" />
      <div className="flex flex-col gap-3 px-4 pb-4">
        <Skeleton className="border-popover bg-muted -mt-8 size-16 rounded-full border-4" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="h-4 w-1/4" />
        </div>
        <Skeleton className="h-4 w-4/5" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
      </div>
    </div>
  );
};
