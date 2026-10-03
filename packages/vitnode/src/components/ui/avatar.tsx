import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";
import { cn } from "cn";
import { motion, useReducedMotion } from "motion/react";
import React from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipGroup,
  TooltipGroupTrigger,
  TooltipTrigger,
  useIsInTooltipGroup,
} from "./tooltip";

function Avatar({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & {
  size?: "default" | "lg" | "sm";
}) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        "group/avatar after:border-border relative flex size-8 shrink-0 rounded-full select-none after:absolute after:inset-0 after:rounded-full after:border after:mix-blend-darken data-[size=lg]:size-10 data-[size=sm]:size-6 dark:after:mix-blend-lighten",
        className,
      )}
      data-size={size}
      data-slot="avatar"
      {...props}
    />
  );
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      className={cn(
        "aspect-square size-full rounded-full object-cover",
        className,
      )}
      data-slot="avatar-image"
      {...props}
    />
  );
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      className={cn(
        "bg-muted text-muted-foreground flex size-full items-center justify-center rounded-full text-sm group-data-[size=sm]/avatar:text-xs",
        className,
      )}
      data-slot="avatar-fallback"
      {...props}
    />
  );
}

function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "bg-primary text-primary-foreground ring-background absolute end-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-blend-color ring-2 select-none",
        "group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden",
        "group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2",
        "group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2",
        className,
      )}
      data-slot="avatar-badge"
      {...props}
    />
  );
}

function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <TooltipGroup>
      <div
        className={cn(
          "group/avatar-group *:data-[slot=avatar]:ring-background flex -space-x-2 *:data-[slot=avatar]:ring-2",
          className,
        )}
        data-slot="avatar-group"
        {...props}
      />
    </TooltipGroup>
  );
}

const AVATAR_LIFT_TRANSITION = {
  type: "spring",
  stiffness: 300,
  damping: 17,
} as const;

function AvatarGroupItem({
  children,
  className,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  label?: React.ReactNode;
}) {
  const shouldReduceMotion = useReducedMotion();
  const isInTooltipGroup = useIsInTooltipGroup();
  const lift = shouldReduceMotion ? undefined : { y: "-25%" };

  const item = (
    <motion.div
      className={cn(
        "focus-visible:ring-ring/50 *:data-[slot=avatar]:ring-background relative rounded-full outline-none hover:z-10 focus-visible:z-10 focus-visible:ring-3 *:data-[slot=avatar]:ring-2",
        className,
      )}
      data-slot="avatar-group-item"
      tabIndex={label ? 0 : undefined}
      transition={AVATAR_LIFT_TRANSITION}
      whileFocus={lift}
      whileHover={lift}
      whileTap={lift}
    >
      {children}
    </motion.div>
  );

  if (!label) return item;

  if (isInTooltipGroup) {
    return <TooltipGroupTrigger content={label} render={item} />;
  }

  return (
    <Tooltip>
      <TooltipTrigger render={item} />
      <TooltipContent sideOffset={8}>{label}</TooltipContent>
    </Tooltip>
  );
}

function AvatarGroupCount({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "bg-muted text-muted-foreground ring-background relative flex size-8 shrink-0 items-center justify-center rounded-full text-sm ring-2 group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=sm]/avatar-group:size-6 [&>svg]:size-4 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3",
        className,
      )}
      data-slot="avatar-group-count"
      {...props}
    />
  );
}

export {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarGroupItem,
  AvatarImage,
};
