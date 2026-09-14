import { existsSync } from "fs";
import { utimes } from "fs/promises";
import { dirname, join } from "path";

import type { PluginConfigRegistration } from "./add-plugin-to-config.js";

export type DevServerKind = "node" | "vite";

export interface DevServerApp {
  configFiles: readonly string[];
  dir: string;
  viteConfig: null | string;
}

export interface DevServerTarget {
  dir: string;
  files: string[];
  kind: DevServerKind;
}

const VITE_CONFIG_NAMES = [
  "vite.config.ts",
  "vite.config.mts",
  "vite.config.js",
  "vite.config.mjs",
] as const;

const byString = (a: string, b: string): number =>
  a === b ? 0 : a < b ? -1 : 1;

export const devCommandFor = (packageManager: string): string => {
  const name = packageManager.split("@")[0];

  return name === "npm" ? "npm run dev" : `${name} dev`;
};

export const isRegistered = ({ status }: PluginConfigRegistration): boolean =>
  status === "already-registered" || status === "registered";

export const devServerTargets = (
  apps: readonly DevServerApp[],
): DevServerTarget[] =>
  apps
    .map(({ configFiles, dir, viteConfig }): DevServerTarget => ({
      dir,
      files:
        viteConfig === null
          ? [...new Set(configFiles)].sort(byString)
          : [viteConfig],
      kind: viteConfig === null ? "node" : "vite",
    }))
    .filter(target => target.files.length > 0)
    .sort((a, b) => byString(a.dir, b.dir));

export const packageRootOf = (
  file: string,
  rootPath: string,
  hasPackageJson: (dir: string) => boolean,
): null | string => {
  let current = dirname(file);

  for (;;) {
    if (hasPackageJson(current)) return current;
    if (current === rootPath) return null;

    const parent = dirname(current);
    if (parent === current) return null;

    current = parent;
  }
};

export const appsFromRegistrations = (
  registrations: readonly PluginConfigRegistration[],
  {
    hasPackageJson,
    rootPath,
    viteConfigIn,
  }: {
    hasPackageJson: (dir: string) => boolean;
    rootPath: string;
    viteConfigIn: (dir: string) => null | string;
  },
): DevServerApp[] => {
  const byDir = new Map<string, string[]>();

  for (const registration of registrations.filter(isRegistered)) {
    const dir = packageRootOf(registration.file, rootPath, hasPackageJson);
    if (dir === null) continue;

    byDir.set(dir, [...(byDir.get(dir) ?? []), registration.file]);
  }

  return [...byDir].map(([dir, configFiles]) => ({
    configFiles,
    dir,
    viteConfig: viteConfigIn(dir),
  }));
};

const viteConfigIn = (dir: string): null | string =>
  VITE_CONFIG_NAMES.map(name => join(dir, name)).find(file =>
    existsSync(file),
  ) ?? null;

export const restartDevServers = async ({
  now = new Date(),
  registrations,
  rootPath,
}: {
  now?: Date;
  registrations: readonly PluginConfigRegistration[];
  rootPath: string;
}): Promise<DevServerTarget[]> => {
  const targets = devServerTargets(
    appsFromRegistrations(registrations, {
      hasPackageJson: dir => existsSync(join(dir, "package.json")),
      rootPath,
      viteConfigIn,
    }),
  );
  const restarted: DevServerTarget[] = [];

  for (const target of targets) {
    const touched: string[] = [];

    for (const file of target.files) {
      try {
        await utimes(file, now, now);
        touched.push(file);
      } catch {
        continue;
      }
    }

    if (touched.length > 0) restarted.push({ ...target, files: touched });
  }

  return restarted;
};
