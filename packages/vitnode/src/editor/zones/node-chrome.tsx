import type { ReactElement, ReactNode } from "react";

import { cn } from "cn";

import type { EditorDropAxis, EditorDropEdge } from "../dnd/resolve-drop";
import type { ZoneDropTone } from "./drop-state";

export const NODE_ARRIVAL_CLASS =
  "animate-in fade-in zoom-in-98 duration-250 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:animate-none";

export const DROP_TARGET_CLASSES = {
  blocked: "border-border bg-muted/50 text-muted-foreground",
  idle: "border-primary/40 bg-primary/5 text-primary",
  inserting: "border-primary/60 bg-primary/10 text-primary",
  over: "border-primary bg-primary/15 text-primary",
  rejected: "border-destructive/50 bg-destructive/5 text-destructive",
  targeting: "border-primary/60 bg-primary/10 text-primary",
} as const satisfies Record<ZoneDropTone, string>;

export const NODE_DESTRUCTIVE_ACTION_CLASS =
  "hover:bg-destructive/10 hover:text-destructive";

export const NodeToolbar = ({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}): ReactElement => (
  <div
    className={cn(
      "border-border bg-popover text-popover-foreground flex items-center gap-0.5 rounded-lg border p-0.5 shadow-md transition-[opacity,translate] duration-150 ease-out motion-reduce:transition-none",
      className,
    )}
  >
    {children}
  </div>
);

export const NodeToolbarSeparator = (): ReactElement => (
  <span aria-hidden="true" className="bg-border mx-0.5 h-4 w-px" />
);

export const DropIndicator = ({
  axis,
  edge,
}: {
  axis: EditorDropAxis;
  edge: EditorDropEdge;
}): ReactElement => (
  <span
    aria-hidden="true"
    className={cn(
      "bg-primary ring-primary/20 animate-in fade-in zoom-in-95 pointer-events-none absolute z-20 rounded-full ring-4 duration-150 ease-out motion-reduce:animate-none",
      axis === "horizontal"
        ? cn("inset-y-0 w-0.5", edge === "before" ? "-start-1" : "-end-1")
        : cn("inset-x-0 h-0.5", edge === "before" ? "-top-1" : "-bottom-1"),
    )}
  >
    <span
      className={cn(
        "border-primary bg-background absolute size-2.5 rounded-full border-2",
        axis === "horizontal"
          ? "start-1/2 -top-1 -translate-x-1/2 rtl:translate-x-1/2"
          : "-start-1 top-1/2 -translate-y-1/2",
      )}
    />
  </span>
);
