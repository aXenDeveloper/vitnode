import { cn } from "cn";
import { Icon } from "lucide-react";
import React from "react";

import {
  loadLucideIcon,
  LucideIconCollectorContext,
  readLucideIcon,
  subscribeLucideIcons,
} from "./icon-registry";

/** Props of {@link DynamicIcon}, passed to Lucide's `Icon`. */
export interface DynamicIconProps {
  absoluteStrokeWidth?: boolean;
  className?: string;
  /** The Lucide icon name in kebab case, e.g. `"newspaper"`. */
  name: string;
  size?: number | string;
  strokeWidth?: number | string;
}

/**
 * A Lucide icon chosen by name at runtime, loaded on demand. Shows `fallback`
 * (a blank, hidden placeholder by default) while it loads and `missing`
 * (nothing by default) for an unknown name.
 */
export const DynamicIcon = ({
  className,
  fallback,
  missing = null,
  name,
  ...props
}: DynamicIconProps & {
  fallback?: React.ReactNode;
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
