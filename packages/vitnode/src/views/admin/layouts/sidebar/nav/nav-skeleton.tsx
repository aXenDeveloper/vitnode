import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const ITEM_WIDTHS = ["w-24", "w-20", "w-28", "w-16", "w-22"];

export const NavSidebarAdminSkeleton = () => (
  <SidebarGroup>
    <SidebarGroupLabel>
      <Skeleton className="h-3 w-12" />
    </SidebarGroupLabel>

    <SidebarMenu>
      {ITEM_WIDTHS.map(width => (
        <div className="flex h-8 items-center gap-2 px-2" key={width}>
          <Skeleton className="size-4 shrink-0 rounded-md" />
          <Skeleton className={cn("h-4", width)} />
        </div>
      ))}
    </SidebarMenu>
  </SidebarGroup>
);
