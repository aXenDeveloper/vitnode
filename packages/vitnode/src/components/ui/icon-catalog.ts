import type React from "react";

import {
  componentNameToIconName,
  iconNameToComponentName,
} from "@/lib/emoji-icon";

export type LucideIconComponent = React.ComponentType<{
  absoluteStrokeWidth?: boolean;
  className?: string;
  size?: number | string;
  strokeWidth?: number | string;
}>;

export interface LucideIconCatalog {
  get: (name: string) => LucideIconComponent | undefined;
  names: string[];
}

let catalog: Promise<LucideIconCatalog> | undefined;

// oxlint-disable-next-line typescript/promise-function-async
export const loadLucideIconCatalog = (): Promise<LucideIconCatalog> => {
  catalog ??= import("lucide-react").then(({ icons }) => {
    const components = icons as unknown as Record<
      string,
      LucideIconComponent | undefined
    >;
    const names = Object.keys(components).map(componentNameToIconName).sort();

    return {
      get: (name: string) => components[iconNameToComponentName(name)],
      names,
    };
  });

  return catalog;
};
