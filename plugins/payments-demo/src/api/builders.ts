import { bindApiPlugin } from "@vitnode/core/api/lib/bind-api-plugin";

import { manifest } from "@/manifest.gen";

const apiBuilders = bindApiPlugin(manifest);

export const buildModule = apiBuilders.buildModule;
export const buildRoute = apiBuilders.buildRoute;
