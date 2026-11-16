import type { ApiPluginContract } from "@vitnode/api/lib/plugin";

import { buildApiPlugin } from "@vitnode/api/lib/plugin";

import { purchasesModule } from "@/api/modules/purchases/purchases.module";
import { manifest } from "@/manifest.gen";

export const paymentsDemoApiPlugin = () =>
  buildApiPlugin({
    manifest,
    modules: [purchasesModule],
  });

export type VitNodeApiPlugin = ApiPluginContract<
  ReturnType<typeof paymentsDemoApiPlugin>
>;
