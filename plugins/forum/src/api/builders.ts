import { bindApiPlugin } from "@vitnode/core/api/lib/bind-api-plugin";
import { bindContentPlugin } from "@vitnode/core/content/server";

import { manifest } from "@/manifest.gen";

export const { buildModule, buildRoute } = bindApiPlugin(manifest);
export const { buildContentAdminModule, buildContentPublicModule } =
  bindContentPlugin(manifest);
