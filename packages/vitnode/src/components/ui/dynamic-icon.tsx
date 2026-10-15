import { cn } from "cn";
import { Icon } from "lucide-react";
import React from "react";

import {
  loadLucideIcon,
  LucideIconCollectorContext,
  readLucideIcon,
  subscribeLucideIcons,
} from "./icon-registry";

export interface DynamicIconProps {
  absoluteStrokeWidth?: boolean;
  className?: string;
  name: string;
  size?: number | string;
  strokeWidth?: number | string;
}

export const DynamicIcon = ({
  className,
  fallback,
  missing = null,
  name,
  ...props
}: DynamicIconProps & {
  /** Shown while the icon loads. */
  fallback?: React.ReactNode;
  /** Shown when Lucide has no icon by that name. Nothing by default. */
  missing?: React.ReactNode;
}) => {
  const collector = React.use(LucideIconCollectorContext);
  const icon = React.useSyncExternalStore(
    subscribeLucideIcons,
    () => readLucideIcon(name),
    () => (collector ? readLucideIcon(name) : undefined),
  );

  React.useEffect(() => {
    if (icon === undefined) void loadLucideIcon(name);
  }, [icon, name]);

  if (icon === undefined) {
    return (
      <>
        {fallback ?? (
          <span aria-hidden className={cn("inline-block size-4", className)} />
        )}
      </>
    );
  }

  collector?.collect(name, icon);

  if (icon === null) return <>{missing}</>;

  return <Icon className={className} icon={icon} {...props} />;
};
