const modalScrimSurfaceClassName =
  "fixed inset-0 isolate z-50 bg-black/30 supports-backdrop-filter:backdrop-blur-xs reduced-transparency:backdrop-blur-none dark:bg-black/60";

export const modalScrimClassName = `${modalScrimSurfaceClassName} transition-opacity ease-fluid data-ending-style:opacity-0 data-starting-style:opacity-0 starting:opacity-0 motion-reduce:transition-none`;

export const dialogScrimClassName = `${modalScrimSurfaceClassName} duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 motion-reduce:animate-none`;

export const dialogPopupMotionClassName =
  "duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 motion-reduce:animate-none";
