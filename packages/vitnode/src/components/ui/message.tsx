import { cn } from "cn";
import * as React from "react";

/** A vertical stack of chat {@link Message}s. */
function MessageGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex min-w-0 flex-col gap-2", className)}
      data-slot="message-group"
      {...props}
    />
  );
}

/**
 * One chat message: avatar plus content. `align="end"` (default `"start"`)
 * mirrors it for the current user's own messages.
 */
function Message({
  className,
  align = "start",
  ...props
}: React.ComponentProps<"div"> & { align?: "end" | "start" }) {
  return (
    <div
      className={cn(
        "group/message relative flex w-full min-w-0 gap-2 text-sm data-[align=end]:flex-row-reverse",
        className,
      )}
      data-align={align}
      data-slot="message"
      {...props}
    />
  );
}

/** The author's avatar beside a {@link Message}. */
function MessageAvatar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "bg-muted flex w-fit min-w-8 shrink-0 items-center justify-center self-end overflow-hidden rounded-full group-has-data-[slot=message-footer]/message:mb-8.5",
        className,
      )}
      data-slot="message-avatar"
      {...props}
    />
  );
}

/** The bubbles or body of a {@link Message}. */
function MessageContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col gap-2.5 wrap-break-word group-data-[align=end]/message:*:data-slot:self-end",
        className,
      )}
      data-slot="message-content"
      {...props}
    />
  );
}

/** Small muted line above the content, e.g. the author's name. */
function MessageHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "text-muted-foreground flex max-w-full min-w-0 items-center px-3 text-xs font-medium group-has-data-[variant=ghost]/message:px-0",
        className,
      )}
      data-slot="message-header"
      {...props}
    />
  );
}

/**
 * Small muted line below the content, e.g. the time; aligned with the message.
 */
function MessageFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "text-muted-foreground flex h-6 max-w-full min-w-0 items-center px-3 text-xs font-medium group-has-data-[variant=ghost]/message:px-0 group-data-[align=end]/message:justify-end",
        className,
      )}
      data-slot="message-footer"
      {...props}
    />
  );
}

export {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageGroup,
  MessageHeader,
};
