import { bindApiPlugin } from "@vitnode/core/api/lib/bind-api-plugin";

import { manifest } from "@/manifest.gen";

export const { buildModule, buildRoute } = bindApiPlugin(manifest);
