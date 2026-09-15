import { cn } from "cn";
import { Icon } from "lucide-react";
import React from "react";

import { loadLucideIcon } from "./icon-registry";

export interface DynamicIconProps {
  absoluteStrokeWidth?: boolean;
  className?: string;
  name: string;
  size?: number | string;
  strokeWidth?: number | string;
}

const ResolvedIcon = ({ name, ...props }: DynamicIconProps) => {
  const icon = React.use(loadLucideIcon(name));

  return icon ? <Icon icon={icon} {...props} /> : null;
};

export const DynamicIcon = ({
  className,
  fallback,
  ...props
}: DynamicIconProps & { fallback?: React.ReactNode }) => (
  <React.Suspense
    fallback={
      fallback ?? (
        <span aria-hidden className={cn("inline-block size-4", className)} />
      )
    }
  >
    <ResolvedIcon className={className} {...props} />
  </React.Suspense>
);
