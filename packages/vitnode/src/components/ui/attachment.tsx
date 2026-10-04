import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import * as React from "react";

import { Button } from "@/components/ui/button";

const attachmentVariants = cva(
  "group/attachment relative flex w-fit max-w-full min-w-0 shrink-0 flex-wrap rounded-xl border bg-card text-card-foreground transition-colors duration-150 ease-fluid motion-reduce:transition-none has-[[data-slot=attachment-trigger]:focus-visible]:ring-2 has-[[data-slot=attachment-trigger]:focus-visible]:ring-ring/50 has-[>a,>button]:hover:bg-muted/50 data-[state=error]:border-destructive/30 data-[state=idle]:border-dashed",
  {
    variants: {
      size: {
        default:
          "gap-2 text-sm has-data-[slot=attachment-content]:px-2.5 has-data-[slot=attachment-content]:py-2 has-data-[slot=attachment-media]:p-2",
        sm: "gap-2.5 text-xs has-data-[slot=attachment-content]:px-2 has-data-[slot=attachment-content]:py-1.5 has-data-[slot=attachment-media]:p-1.5",
        xs: "gap-1.5 rounded-lg text-xs has-data-[slot=attachment-content]:px-1.5 has-data-[slot=attachment-content]:py-1 has-data-[slot=attachment-media]:p-1",
      },
      orientation: {
        horizontal: "min-w-40 items-center",
        vertical: "w-24 flex-col has-data-[slot=attachment-content]:w-30",
      },
    },
  },
);

function Attachment({
  className,
  state = "done",
  size = "default",
  orientation = "horizontal",
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof attachmentVariants> & {
    state?: "done" | "error" | "idle" | "processing" | "uploading";
  }) {
  return (
    <div
      className={cn(attachmentVariants({ size, orientation }), className)}
      data-orientation={orientation}
      data-size={size}
      data-slot="attachment"
      data-state={state}
      {...props}
    />
  );
}

const attachmentMediaVariants = cva(
  "relative flex aspect-square w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-foreground group-data-[orientation=vertical]/attachment:w-full group-data-[size=sm]/attachment:w-8 group-data-[size=xs]/attachment:w-7 group-data-[size=xs]/attachment:rounded-md group-data-[state=error]/attachment:bg-destructive/10 group-data-[state=error]/attachment:text-destructive group-data-[orientation=vertical]/attachment:*:data-[slot=spinner]:size-6! [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 group-data-[orientation=vertical]/attachment:[&_svg:not([class*='size-'])]:size-6 group-data-[size=xs]/attachment:[&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        icon: "",
        image:
          "opacity-60 group-data-[state=done]/attachment:opacity-100 group-data-[state=idle]/attachment:opacity-100 *:[img]:aspect-square *:[img]:w-full *:[img]:object-cover",
      },
    },
    defaultVariants: {
      variant: "icon",
    },
  },
);

function AttachmentMedia({
  className,
  variant = "icon",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof attachmentMediaVariants>) {
  return (
    <div
      className={cn(attachmentMediaVariants({ variant }), className)}
      data-slot="attachment-media"
      data-variant={variant}
      {...props}
    />
  );
}

function AttachmentContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "max-w-full min-w-0 flex-1 leading-tight group-data-[orientation=vertical]/attachment:px-1",
        className,
      )}
      data-slot="attachment-content"
      {...props}
    />
  );
}

const FILE_EXTENSION_MAX_LENGTH = 10;

const splitFileName = (name: string): [string, string] => {
  const dot = name.lastIndexOf(".");
  const extensionLength = name.length - dot;

  if (dot <= 0 || extensionLength > FILE_EXTENSION_MAX_LENGTH) {
    return [name, ""];
  }

  return [name.slice(0, dot), name.slice(dot)];
};

function AttachmentTitle({
  children,
  className,
  ...props
}: React.ComponentProps<"span">) {
  const [stem, extension] =
    typeof children === "string" ? splitFileName(children) : [children, ""];

  return (
    <span
      className={cn(
        "group-data-[state=processing]/attachment:shimmer group-data-[state=uploading]/attachment:shimmer motion-reduce:shimmer-none flex max-w-full min-w-0 font-medium",
        className,
      )}
      data-slot="attachment-title"
      title={typeof children === "string" ? children : undefined}
      {...props}
    >
      <span className="min-w-0 truncate">{stem}</span>
      {extension !== "" && <span className="shrink-0">{extension}</span>}
    </span>
  );
}

function AttachmentDescription({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "text-muted-foreground group-data-[state=error]/attachment:text-destructive/80 mt-0.5 block min-w-0 truncate text-xs",
        "max-w-full",
        className,
      )}
      data-slot="attachment-description"
      {...props}
    />
  );
}

function AttachmentActions({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "relative z-20 flex shrink-0 items-center group-data-[orientation=vertical]/attachment:absolute group-data-[orientation=vertical]/attachment:end-3 group-data-[orientation=vertical]/attachment:top-3 group-data-[orientation=vertical]/attachment:gap-1",
        className,
      )}
      data-slot="attachment-actions"
      {...props}
    />
  );
}

function AttachmentAction({
  className,
  variant,
  size = "icon-xs",
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      aria-label="Attachment action"
      className={cn("pointer-coarse:size-10", className)}
      data-slot="attachment-action"
      size={size}
      variant={variant ?? "ghost"}
      {...props}
    />
  );
}

function AttachmentTrigger({
  className,
  render,
  type,
  ...props
}: useRender.ComponentProps<"button">) {
  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        type: render ? type : (type ?? "button"),
        className: cn("absolute inset-0 z-10 outline-none", className),
      },
      props,
    ),
    render,
    state: {
      slot: "attachment-trigger",
    },
  });
}

function AttachmentGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "scroll-fade-x no-scrollbar flex min-w-0 snap-x snap-mandatory scroll-px-1 gap-3 overflow-x-auto overscroll-x-contain py-1 *:data-[slot=attachment]:flex-none *:data-[slot=attachment]:snap-start",
        className,
      )}
      data-slot="attachment-group"
      {...props}
    />
  );
}

export {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
};
