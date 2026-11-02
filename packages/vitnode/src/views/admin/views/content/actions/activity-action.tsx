import React from "react";
import { useTranslations } from "use-intl";

import type { ContentId } from "@/content/ids";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityHistoryPending } from "@/views/activity-logs/activity-history-pending";

import type { ContentPanelProps } from "./content-panel";

const ActivityHistory = React.lazy(
  async () =>
    await import("@/views/activity-logs/activity-history").then(mod => ({
      default: mod.ActivityHistory,
    })),
);

interface ActivityPanelBodyProps {
  contentTypeId: string;
  id: ContentId;
  pluginId: string;
  singular: string;
}

const ActivityPanelPending = () => {
  const t = useTranslations("core.global");

  return (
    <>
      <SheetHeader className="border-b pe-12">
        <SheetTitle className="sr-only">{t("loading")}</SheetTitle>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </SheetHeader>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        <ActivityHistoryPending label={t("loading")} />
      </div>
    </>
  );
};

const ActivityPanelBody = ({
  contentTypeId,
  id,
  pluginId,
  singular,
}: ActivityPanelBodyProps) => {
  const t = useTranslations("core.activity_logs.history");

  return (
    <>
      <SheetHeader className="border-b pe-12">
        <SheetTitle className="text-balance">
          {`${t("title")} · ${singular}`}
        </SheetTitle>
        <SheetDescription className="text-pretty">{t("desc")}</SheetDescription>
      </SheetHeader>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        <ActivityHistory
          pluginId={pluginId}
          targetId={id}
          targetType={contentTypeId}
        />
      </div>
    </>
  );
};

/**
 * "Activity" on a content row: the record's entries from the central Activity
 * Logs - who created, edited, published or moderated it - in a sheet beside
 * the list. Separate from "History", which shows what its content used to be.
 *
 * The sheet opens at once and its body suspends behind a skeleton inside it,
 * so `wrapBody` can load the Activity Logs messages the content screen lacks
 * without blanking the list.
 */
export const ActivityContentPanel = ({
  finalFocus,
  onOpenChange,
  open,
  wrapBody,
  ...body
}: ActivityPanelBodyProps &
  ContentPanelProps & {
    /** Wraps the body in a provider of the messages it reads. */
    wrapBody: (body: React.ReactNode) => React.ReactNode;
  }) => (
  <Sheet onOpenChange={onOpenChange} open={open}>
    <SheetContent
      className="w-full gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
      finalFocus={finalFocus}
    >
      <React.Suspense fallback={<ActivityPanelPending />}>
        {wrapBody(<ActivityPanelBody {...body} />)}
      </React.Suspense>
    </SheetContent>
  </Sheet>
);
