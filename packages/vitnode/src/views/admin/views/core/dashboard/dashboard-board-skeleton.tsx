import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { HeaderContent } from "@/components/ui/header-content";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { DashboardHeaderContent } from "./widgets/types";

import { gridClasses, rowsClasses, spanClasses } from "./grid/span-classes";
import { WidgetContentSkeleton } from "./grid/widget-skeleton";

/**
 * Sized after the widgets core ships enabled, so the board that streams in
 * lands close to the placeholder on the common first load. An admin who has
 * arranged their own is the case this cannot predict.
 */
const PLACEHOLDER_CARDS = [
  { id: "s-wide", rows: 2, span: 2 },
  { id: "s-short", rows: 1, span: 2 },
] as const;

export const DashboardBoardSkeleton = ({
  header,
}: {
  header: DashboardHeaderContent;
}) => (
  <>
    <HeaderContent desc={header.desc} h1={header.h1}>
      <Skeleton className="h-8 w-20" />
    </HeaderContent>

    <div className={gridClasses}>
      {PLACEHOLDER_CARDS.map(({ id, rows, span }) => (
        <Card
          className={cn("flex flex-col", spanClasses[span], rowsClasses[rows])}
          key={id}
        >
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="flex-1">
            <WidgetContentSkeleton rows={rows} />
          </CardContent>
        </Card>
      ))}
    </div>
  </>
);
