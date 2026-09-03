import type { Plugin } from "vite";

import type { VitNodeEnvOptions } from "./env";
import type { VitNodePluginRoutesOptions } from "./plugin-routes";

import { vitNodeEnv } from "./env";
import { vitNodeOptimizeDeps } from "./optimize-deps";
import { vitNodePluginRoutes } from "./plugin-routes";
import { vitNodeSsrExternals } from "./ssr-externals";

export interface VitNodeViteOptions
  extends VitNodeEnvOptions, VitNodePluginRoutesOptions {}

export const vitnode = ({
  appRoot,
  clientEnv,
  hostRoutesDir,
}: VitNodeViteOptions): Plugin[] => [
  vitNodeEnv({ clientEnv }),
  vitNodeOptimizeDeps(),
  vitNodeSsrExternals({ appRoot }),
  vitNodePluginRoutes({ appRoot, hostRoutesDir }),
];
