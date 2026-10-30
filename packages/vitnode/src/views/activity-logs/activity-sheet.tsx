import React from "react";
import { useTranslations } from "use-intl";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import type { ActivityEntry, ActivityFilterOptions } from "./activity-query";

import { ActivityDetailPending } from "./activity-detail-pending";
import { useActivityLabels } from "./activity-labels";

const ActivityDetailContent = React.lazy(
  async () => await import("./activity-detail"),
);

/**
 * The detail Sheet of one entry. Open while `entryId` is set - the screen
 * keeps it in the URL, so a detail can be linked and survives a reload. The
 * body is lazy: the list never pays for it.
 */
export const ActivitySheet = ({
  entry,
  entryId,
  onFilterActor,
  onOpenChange,
  plugins,
}: {
  /** The row it was opened from, for an instant title; absent on a direct link. */
  entry?: ActivityEntry;
  entryId: null | number;
  onFilterActor?: (actor: { id: number; name: string }) => void;
  onOpenChange: (open: boolean) => void;
  plugins: ActivityFilterOptions["plugins"];
}) => {
  const t = useTranslations("core.activity_logs.detail");
  const labels = useActivityLabels(plugins);

  return (
    <Sheet onOpenChange={onOpenChange} open={entryId !== null}>
      <SheetContent className="w-full gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
        <SheetHeader className="border-b">
          <SheetTitle className="text-balance">
            {entry ? labels.action(entry) : t("title")}
          </SheetTitle>
          <SheetDescription className="text-pretty">
            {entry ? labels.target(entry) : null}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          {entryId === null ? null : (
            <React.Suspense fallback={<ActivityDetailPending />}>
              <ActivityDetailContent
                id={entryId}
                onFilterActor={onFilterActor}
                plugins={plugins}
              />
            </React.Suspense>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
