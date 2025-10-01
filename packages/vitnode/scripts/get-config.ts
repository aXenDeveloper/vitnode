/* eslint-disable no-console */
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import type { VitNodeApiConfig, VitNodeConfig } from "../src/vitnode.config";

type ConfigType<T extends "api.config" | "config"> = T extends "config"
  ? VitNodeConfig
  : VitNodeApiConfig;

export const getConfig = async <T extends "api.config" | "config">({
  type = "config" as T,
}: {
  type?: T;
}): Promise<ConfigType<T>> => {
  const configPath = join(process.cwd(), "src", `vitnode.${type}.ts`);
  try {
    const configUrl = pathToFileURL(configPath).href;
    const loaded = await import(configUrl);
    const config =
      type === "config" ? loaded.vitNodeConfig : loaded.vitNodeApiConfig;

    return config as ConfigType<T>;
  } catch (error) {
    console.error("Failed to load config:", error);
    process.exit(1);
  }
};
