const modalScrimSurfaceClassName =
  "fixed inset-0 isolate z-50 bg-black/30 supports-backdrop-filter:backdrop-blur-xs reduced-transparency:backdrop-blur-none dark:bg-black/60";

export const modalScrimClassName = `${modalScrimSurfaceClassName} transition-opacity ease-fluid data-ending-style:opacity-0 data-starting-style:opacity-0 starting:opacity-0 motion-reduce:transition-none`;

export const dialogScrimClassName = `${modalScrimSurfaceClassName} ease-fluid duration-200 data-closed:duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 motion-reduce:animate-none`;

export const dialogPopupMotionClassName =
  "ease-fluid duration-200 data-closed:duration-150 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 motion-reduce:animate-none";

export const dialogFrameClassName =
  "bg-popover text-popover-foreground inset-ring-border ring-border ring-offset-muted rounded-md shadow-xl outline-none inset-ring ring-1 ring-offset-8";

export const dialogFooterFrameClassName =
  "bg-muted before:bg-popover relative -mx-6 -mb-6 px-0 pt-6 pb-1 before:absolute before:inset-x-0 before:top-0 before:h-3 before:rounded-b-md before:border-x before:border-b before:border-border";

export const dialogStackClassName =
  "after:bg-popover after:ease-fluid transition-[translate,scale] after:pointer-events-none after:absolute after:inset-0 after:rounded-md after:opacity-0 after:transition-opacity after:duration-200 motion-reduce:transition-none motion-reduce:after:transition-none data-nested-dialog-open:translate-y-[calc(-50%+var(--dialog-stack-offset,0px))] data-nested-dialog-open:scale-(--dialog-stack-scale,1) data-nested-dialog-open:after:opacity-60";
