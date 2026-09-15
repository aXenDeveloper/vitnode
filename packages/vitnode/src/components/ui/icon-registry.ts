import type { LucideIconData } from "lucide-react";
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

export interface LucideIconRegistry {
  get: (name: string) => LucideIconComponent | undefined;
  names: string[];
}

type LucideIconLoader = () => Promise<{ __iconData?: LucideIconData }>;

let loaders: Promise<Map<string, LucideIconLoader>> | undefined;

// eslint-disable-next-line @typescript-eslint/promise-function-async
const loadIconLoaders = (): Promise<Map<string, LucideIconLoader>> => {
  loaders ??= import("lucide-react/dynamicIconImports.mjs").then(
    ({ default: imports }) => {
      const entries = Object.entries(
        imports as unknown as Record<string, LucideIconLoader>,
      );
      const resolved = new Map(entries);

      for (const [name, loader] of entries) {
        const componentName = componentNameToIconName(
          iconNameToComponentName(name),
        );

        if (!resolved.has(componentName)) resolved.set(componentName, loader);
      }

      return resolved;
    },
  );

  return loaders;
};

const icons = new Map<string, Promise<LucideIconData | undefined>>();

// eslint-disable-next-line @typescript-eslint/promise-function-async
export const loadLucideIcon = (name: string) => {
  const cached = icons.get(name);

  if (cached) return cached;

  const pending = loadIconLoaders().then(async resolved => {
    const loader = resolved.get(name);

    return loader ? (await loader()).__iconData : undefined;
  });

  icons.set(name, pending);

  return pending;
};

let registry: Promise<LucideIconRegistry> | undefined;

// eslint-disable-next-line @typescript-eslint/promise-function-async
export const loadLucideIcons = (): Promise<LucideIconRegistry> => {
  registry ??= import("lucide-react").then(({ icons }) => {
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

  return registry;
};
