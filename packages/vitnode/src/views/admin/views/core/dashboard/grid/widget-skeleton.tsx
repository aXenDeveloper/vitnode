"use client";

import { useTranslations } from "use-intl";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { AdminDashboardWidgetRows } from "../widgets/types";

const LINE_WIDTHS = ["w-full", "w-11/12", "w-3/4", "w-5/6", "w-2/3"];

export const WidgetContentSkeleton = ({
  rows = 1,
}: {
  rows?: AdminDashboardWidgetRows;
}) => {
  const t = useTranslations("core.global");

  return (
    <div className="flex flex-col gap-3" role="status">
      <span className="sr-only">{t("loading")}</span>

      {Array.from({ length: rows * 2 + 1 }, (_, index) => (
        <Skeleton
          className={cn("h-4", LINE_WIDTHS[index % LINE_WIDTHS.length])}
          key={index}
        />
      ))}
    </div>
  );
};
