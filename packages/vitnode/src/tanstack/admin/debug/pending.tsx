import { useRouterState } from "@tanstack/react-router";
import { cn } from "cn";

import { DataTableSkeleton } from "@/components/table/data-table-content";
import { Skeleton } from "@/components/ui/skeleton";

import type { DebugTab } from "./route-search";

import {
  PendingFrame,
  pendingRowKeys,
} from "../../pending/route-pending-skeleton";
import { debugTabFromPath } from "./route-search";

type FrameRowShape = "check" | "fact" | "issue" | "item" | "link" | "service";

const FRAME_ROW_WIDTHS = ["w-24", "w-32", "w-20", "w-28", "w-36", "w-16"];

const rowWidth = (key: number) =>
  FRAME_ROW_WIDTHS[key % FRAME_ROW_WIDTHS.length];

const Line = ({ className }: { className: string }) => (
  <span className="flex h-5 items-center">
    <Skeleton className={cn("h-3.5", className)} />
  </span>
);

const TwoLines = ({ index }: { index: number }) => (
  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
    <Line className={rowWidth(index)} />
    <span className="flex h-4 items-center">
      <Skeleton className={cn("h-3", rowWidth(index + 2))} />
    </span>
  </span>
);

const FramePendingRow = ({
  index,
  shape,
}: {
  index: number;
  shape: FrameRowShape;
}) => {
  if (shape === "fact") {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <Line className={rowWidth(index + 1)} />
        <Line className={rowWidth(index + 3)} />
      </div>
    );
  }

  if (shape === "check") {
    return (
      <div className="flex items-center gap-3 px-4 py-3">
        <Skeleton className="size-4 shrink-0 rounded-full" />
        <Line className="w-56 max-w-full" />
      </div>
    );
  }

  if (shape === "link") {
    return (
      <div className="flex items-center gap-3 px-4 py-3">
        <Skeleton className="size-4 shrink-0 rounded" />
        <span className="w-32 shrink-0 sm:w-40">
          <Line className={rowWidth(index)} />
        </span>
        <span className="min-w-0 flex-1">
          <Line className={rowWidth(index + 1)} />
        </span>
        <Skeleton className="size-4 shrink-0 rounded-full" />
      </div>
    );
  }

  if (shape === "issue") {
    return (
      <div className="flex items-center gap-3 px-4 py-3">
        <Skeleton className="size-4 shrink-0 rounded-full" />
        <TwoLines index={index + 4} />
        <Skeleton className="size-4 shrink-0 rounded" />
      </div>
    );
  }

  if (shape === "service") {
    return (
      <div className="flex items-center gap-3 px-4 py-3">
        <Skeleton className="size-4 shrink-0 rounded-full" />
        <TwoLines index={index} />
        <Skeleton className="h-8 w-28 shrink-0 rounded-md" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <TwoLines index={index} />
      <Line className="w-24" />
    </div>
  );
};

const FramePending = ({
  action = true,
  badge = true,
  rows,
}: {
  action?: boolean;
  badge?: boolean;
  rows: readonly FrameRowShape[];
}) => (
  <div className="bg-muted/50 ring-foreground/10 flex flex-col rounded-lg p-1 ring-1">
    <div className="flex min-h-12 items-center justify-between gap-3 px-3 py-2">
      <div className="flex min-w-0 flex-col">
        <span className="flex h-6 items-center gap-2">
          <Skeleton className="h-4 w-32" />
          {badge ? <Skeleton className="h-5 w-16 rounded-full" /> : null}
        </span>
        <span className="flex h-5 items-center">
          <Skeleton className="h-3.5 w-44 max-w-full" />
        </span>
      </div>
      {action ? (
        <Skeleton className="h-8 w-32 shrink-0 rounded-md max-sm:hidden" />
      ) : null}
    </div>
    <div className="bg-card ring-foreground/10 flex flex-col overflow-hidden rounded-md shadow-xs ring-1 [&>*:not(:last-child)]:border-b">
      {pendingRowKeys(rows.length).map(key => (
        <FramePendingRow index={key} key={key} shape={rows[key] ?? "fact"} />
      ))}
    </div>
  </div>
);

const SectionHeaderPending = ({
  action = false,
  badge = false,
}: {
  action?: boolean;
  badge?: boolean;
}) => (
  <div className="flex flex-wrap items-start justify-between gap-4">
    <div className="flex min-w-0 flex-col gap-1">
      <span className="flex h-7 items-center gap-2">
        <Skeleton className="h-5 w-36" />
        {badge ? <Skeleton className="h-5 w-20 rounded-full" /> : null}
      </span>
      <span className="flex h-6 items-center">
        <Skeleton className="h-3.5 w-72 max-w-full" />
      </span>
    </div>
    {action ? <Skeleton className="h-9 w-36 rounded-md" /> : null}
  </div>
);

const CronSchedulerPending = () => (
  <div className="bg-card ring-foreground/10 flex flex-col gap-5 rounded-xl p-5 shadow-xs ring-1 md:flex-row md:items-center md:justify-between">
    <div className="flex items-start gap-4">
      <Skeleton className="size-10 shrink-0 rounded-full" />
      <div className="flex flex-col gap-2 pt-1">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3.5 w-64 max-w-full" />
      </div>
    </div>
    <div className="grid shrink-0 grid-cols-3 gap-4 md:gap-6">
      {pendingRowKeys(3).map(key => (
        <div className="flex flex-col gap-2" key={key}>
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  </div>
);

const SearchStatsPending = () => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
    {pendingRowKeys(4).map(key => (
      <div
        className="bg-card ring-foreground/10 flex flex-col gap-4 rounded-xl p-6 shadow-xs ring-1"
        key={key}
      >
        <div className="flex items-center gap-2.5">
          <Skeleton className="size-8 shrink-0 rounded-lg" />
          <Skeleton className="h-3.5 w-20" />
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-3.5 w-32" />
        </div>
      </div>
    ))}
  </div>
);

const SearchCollectionsPending = () => (
  <div className="bg-card ring-foreground/10 flex flex-col gap-6 rounded-xl p-6 shadow-xs ring-1">
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3.5 w-80 max-w-full" />
      </div>
      <Skeleton className="h-4 w-10" />
    </div>
    <DataTableSkeleton columns={5} rows={4} toolbar />
  </div>
);

const DEBUG_TAB_CONTENT_PENDING: Record<DebugTab, () => React.ReactNode> = {
  ai: () => (
    <>
      <SectionHeaderPending />
      <DataTableSkeleton columns={6} rows={8} toolbar />
    </>
  ),
  cache: () => <FramePending rows={["check", "fact", "fact"]} />,
  cron: () => (
    <>
      <SectionHeaderPending badge />
      <CronSchedulerPending />
      <DataTableSkeleton columns={4} toolbar />
    </>
  ),
  logs: () => (
    <>
      <SectionHeaderPending />
      <DataTableSkeleton columns={5} rows={10} />
    </>
  ),
  overview: () => (
    <>
      <FramePending badge={false} rows={["issue"]} />
      <FramePending
        badge={false}
        rows={["link", "link", "link", "link", "link", "link"]}
      />
    </>
  ),
  plugins: () => <FramePending rows={["item", "item", "item"]} />,
  queue: () => (
    <>
      <SectionHeaderPending />
      <DataTableSkeleton columns={7} header rows={10} />
    </>
  ),
  search: () => (
    <>
      <SectionHeaderPending action badge />
      <SearchStatsPending />
      <SearchCollectionsPending />
    </>
  ),
  services: () => (
    <FramePending
      action={false}
      rows={["service", "service", "service", "service", "service"]}
    />
  ),
  vitnode: () => <FramePending rows={["check", "fact", "fact", "fact"]} />,
};

const DebugTabContentPending = ({ tab }: { tab: DebugTab }) => {
  const Content = DEBUG_TAB_CONTENT_PENDING[tab];

  return (
    <div aria-hidden="true" className="flex min-w-0 flex-col gap-6">
      <Content />
    </div>
  );
};

const debugTabPending = (tab: DebugTab) =>
  function DebugTabPending() {
    return (
      <PendingFrame className="p-0">
        <DebugTabContentPending tab={tab} />
      </PendingFrame>
    );
  };

export const DebugOverviewPending = debugTabPending("overview");
export const DebugVitnodePending = debugTabPending("vitnode");
export const DebugPluginsPending = debugTabPending("plugins");
export const DebugCronPending = debugTabPending("cron");
export const DebugCachePending = debugTabPending("cache");
export const DebugSearchPending = debugTabPending("search");
export const DebugServicesPending = debugTabPending("services");
export const DebugLogsPending = debugTabPending("logs");
export const DebugQueuePending = debugTabPending("queue");
export const DebugAiPending = debugTabPending("ai");

const NAV_PENDING_GROUPS = [
  { id: "top", tabs: ["overview"], withTitle: false },
  {
    id: "systems",
    tabs: ["vitnode", "plugins", "cron", "cache", "search", "services"],
    withTitle: true,
  },
  { id: "diagnostics", tabs: ["logs", "queue", "ai"], withTitle: true },
] as const satisfies readonly {
  id: string;
  tabs: readonly DebugTab[];
  withTitle: boolean;
}[];

const NavPending = ({ active }: { active: DebugTab }) => (
  <>
    <Skeleton className="h-9 w-full rounded-md md:hidden" />
    <div className="flex flex-col gap-6 self-start max-md:hidden">
      {NAV_PENDING_GROUPS.map(group => (
        <div className="flex flex-col gap-1.5" key={group.id}>
          {group.withTitle ? (
            <span className="flex h-4 items-center px-2.5">
              <Skeleton className="h-3 w-16" />
            </span>
          ) : null}
          <div className="flex flex-col gap-0.5">
            {group.tabs.map((tab, index) => (
              <div
                className={cn(
                  "flex h-9 items-center gap-3 rounded-lg px-2.5",
                  tab === active && "bg-primary/10",
                )}
                key={tab}
              >
                <Skeleton className="size-4 shrink-0 rounded" />
                <Skeleton
                  className={cn("h-3.5", index % 2 ? "w-20" : "w-24")}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </>
);

export const DebugLayoutPending = () => {
  const tab = useRouterState({
    select: state => debugTabFromPath(state.location.pathname),
  });

  return (
    <PendingFrame className="sm:p-6">
      <div aria-hidden="true" className="flex flex-col gap-1">
        <span className="flex h-8 items-center sm:h-9">
          <Skeleton className="h-7 w-48 sm:h-8" />
        </span>
        <span className="flex h-6 items-center">
          <Skeleton className="h-4 w-96 max-w-full" />
        </span>
      </div>

      <div
        aria-hidden="true"
        className="grid gap-6 md:grid-cols-[14rem_minmax(0,1fr)] lg:grid-cols-[16rem_minmax(0,1fr)]"
      >
        <NavPending active={tab} />
        <DebugTabContentPending tab={tab} />
      </div>
    </PendingFrame>
  );
};
