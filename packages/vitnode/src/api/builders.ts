import { manifest } from "@/manifest";

import { bindApiPlugin } from "./lib/bind-api-plugin";

/** Core's own builders, bound to `@vitnode/core`. Plugins bind their own with `bindApiPlugin`. */
export const { buildModule, buildRoute } = bindApiPlugin(manifest);
