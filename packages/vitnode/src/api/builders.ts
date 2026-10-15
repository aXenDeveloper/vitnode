import { manifest } from "@/manifest";

import { bindApiPlugin } from "./lib/bind-api-plugin";

export const { buildModule, buildRoute } = bindApiPlugin(manifest);
