import { buildModule } from "@/api/lib/module";
import { CONFIG_PLUGIN } from "@/config";

import {
  deleteAiUserOverrideAdminRoute,
  getAiAccessAdminRoute,
  updateAiRoleAccessAdminRoute,
  updateAiUserOverrideAdminRoute,
} from "./routes/access.route";
import { listAiActionsAdminRoute } from "./routes/actions.route";
import { assistAiAdminRoute } from "./routes/assist.route";
import {
  listAiHistoryAdminRoute,
  showAiRunAdminRoute,
} from "./routes/history.route";
import { listAiModelsAdminRoute } from "./routes/models.route";
import { aiOverviewAdminRoute } from "./routes/overview.route";
import { getAiSettingsAdminRoute } from "./routes/settings.route";
import { syncAiPricingAdminRoute } from "./routes/sync-pricing.route";
import { testAiActionAdminRoute } from "./routes/test-action.route";
import { updateAiActionAdminRoute } from "./routes/update-action.route";
import {
  deleteAiPricingAdminRoute,
  updateAiPricingAdminRoute,
} from "./routes/update-pricing.route";
import { updateAiSettingsAdminRoute } from "./routes/update-settings.route";

export const aiAdminModule = buildModule({
  pluginId: CONFIG_PLUGIN.pluginId,
  name: "ai",
  routes: [
    aiOverviewAdminRoute,
    getAiSettingsAdminRoute,
    updateAiSettingsAdminRoute,
    listAiModelsAdminRoute,
    updateAiPricingAdminRoute,
    deleteAiPricingAdminRoute,
    syncAiPricingAdminRoute,
    listAiActionsAdminRoute,
    updateAiActionAdminRoute,
    testAiActionAdminRoute,
    getAiAccessAdminRoute,
    updateAiRoleAccessAdminRoute,
    updateAiUserOverrideAdminRoute,
    deleteAiUserOverrideAdminRoute,
    listAiHistoryAdminRoute,
    showAiRunAdminRoute,
    assistAiAdminRoute,
  ],
});
