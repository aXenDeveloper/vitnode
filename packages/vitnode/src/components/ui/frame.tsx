import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cn } from "cn";
import React from "react";

function Frame({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(
          "group/frame bg-muted/50 text-card-foreground ring-foreground/10 flex flex-col rounded-lg p-1 text-sm ring-1",
          className,
        ),
      },
      props,
    ),
    render,
    state: { slot: "frame" },
  });
}

function FrameHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "grid min-h-12 auto-rows-min items-center gap-x-3 px-3 py-2 has-data-[slot=frame-action]:grid-cols-[1fr_auto]",
        className,
      )}
      data-slot="frame-header"
      {...props}
    />
  );
}

function FrameTitle({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(
          "text-foreground text-base leading-normal font-semibold text-balance",
          className,
        ),
      },
      props,
    ),
    render,
    state: { slot: "frame-title" },
  });
}

function FrameDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "text-muted-foreground text-sm leading-relaxed text-pretty",
        className,
      )}
      data-slot="frame-description"
      {...props}
    />
  );
}

function FrameAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "col-start-2 row-span-2 row-start-1 flex items-center gap-2 self-center justify-self-end",
        className,
      )}
      data-slot="frame-action"
      {...props}
    />
  );
}

function FramePanel({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(
          "bg-card text-card-foreground ring-foreground/10 [&>*:not(:last-child)]:border-border flex flex-1 flex-col overflow-hidden rounded-md shadow-xs ring-1 [&>*:not(:last-child)]:border-b [&>[data-slot=item]]:rounded-none [&>[data-slot=item]]:border-x-0 [&>[data-slot=item]]:border-t-0 [&>[data-slot=item]:last-child]:border-b-0",
          className,
        ),
      },
      props,
    ),
    render,
    state: { slot: "frame-panel" },
  });
}

function FrameFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "text-muted-foreground px-3 py-2 text-sm leading-relaxed text-pretty",
        className,
      )}
      data-slot="frame-footer"
      {...props}
    />
  );
}

export {
  Frame,
  FrameAction,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
};
