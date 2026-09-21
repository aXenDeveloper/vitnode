import type { LucideIconData } from "lucide-react";

import React from "react";

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

export type LucideIconSnapshot = Record<string, LucideIconData | null>;

export interface LucideIconCollector {
  collect: (name: string, icon: LucideIconData | null) => void;
  snapshot: () => LucideIconSnapshot;
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

const icons = new Map<string, LucideIconData | null>();
const requests = new Map<string, Promise<LucideIconData | undefined>>();
const listeners = new Set<() => void>();
let everyIconLoaded = false;

const notify = () => {
  for (const listener of listeners) listener();
};

export const readLucideIcon = (
  name: string,
): LucideIconData | null | undefined => {
  const icon = icons.get(name);

  if (icon !== undefined) return icon;

  return everyIconLoaded ? null : undefined;
};

export const subscribeLucideIcons = (listener: () => void): (() => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

export const seedLucideIcons = (seeded: LucideIconSnapshot): void => {
  for (const [name, icon] of Object.entries(seeded)) icons.set(name, icon);

  notify();
};

// eslint-disable-next-line @typescript-eslint/promise-function-async
export const loadLucideIcon = (name: string) => {
  const cached = requests.get(name);

  if (cached) return cached;

  const known = readLucideIcon(name);
  const request =
    known === undefined
      ? loadIconLoaders().then(async resolved => {
          const loader = resolved.get(name);
          const icon = loader ? (await loader()).__iconData : undefined;

          icons.set(name, icon ?? null);
          notify();

          return icon;
        })
      : Promise.resolve(known ?? undefined);

  requests.set(name, request);

  return request;
};

let everyIcon: Promise<void> | undefined;

// eslint-disable-next-line @typescript-eslint/promise-function-async
export const preloadAllLucideIcons = (): Promise<void> => {
  everyIcon ??= loadIconLoaders().then(async resolved => {
    const loaded = await Promise.all(
      [...resolved.entries()].map(
        async ([name, loader]) => [name, (await loader()).__iconData] as const,
      ),
    );

    for (const [name, icon] of loaded) if (icon) icons.set(name, icon);

    everyIconLoaded = true;
    notify();
  });

  return everyIcon;
};

export const createLucideIconCollector = (): LucideIconCollector => {
  const collected = new Map<string, LucideIconData | null>();

  return {
    collect: (name, icon) => {
      collected.set(name, icon);
    },
    snapshot: () => Object.fromEntries(collected),
  };
};

export const LucideIconCollectorContext = React.createContext<
  LucideIconCollector | undefined
>(undefined);

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
