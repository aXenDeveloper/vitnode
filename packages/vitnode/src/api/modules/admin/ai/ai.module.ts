import { buildModule } from "@/api/builders";

import { listAiActionsAdminRoute } from "./routes/actions.route";
import { estimateAiAdminRoute } from "./routes/assist-estimate.route";
import { assistStreamAiAdminRoute } from "./routes/assist-stream.route";
import { assistAiAdminRoute } from "./routes/assist.route";
import { availableAiActionsAdminRoute } from "./routes/available.route";
import { deleteAiUserOverrideAdminRoute } from "./routes/delete-user-override.route";
import { aiFeedbackAdminRoute } from "./routes/feedback.route";
import { listAiHistoryAdminRoute } from "./routes/list-history.route";
import { getTranslationSourcesAdminRoute } from "./routes/list-translation-sources.route";
import { listAiModelsAdminRoute } from "./routes/models.route";
import { aiOverviewAdminRoute } from "./routes/overview.route";
import { getAiSettingsAdminRoute } from "./routes/settings.route";
import { getAiRoleAccessAdminRoute } from "./routes/show-role-access.route";
import { showAiRunAdminRoute } from "./routes/show-run.route";
import { getAiUserOverrideAdminRoute } from "./routes/show-user-override.route";
import { updateAiActionAdminRoute } from "./routes/update-action.route";
import { updateAiRoleAccessAdminRoute } from "./routes/update-role-access.route";
import { updateAiSettingsAdminRoute } from "./routes/update-settings.route";
import { saveTranslationSourcesAdminRoute } from "./routes/update-translation-sources.route";
import { updateAiUserOverrideAdminRoute } from "./routes/update-user-override.route";

export const aiAdminModule = buildModule({
  name: "ai",
  routes: [
    aiOverviewAdminRoute,
    getAiSettingsAdminRoute,
    updateAiSettingsAdminRoute,
    listAiModelsAdminRoute,
    listAiActionsAdminRoute,
    updateAiActionAdminRoute,
    getAiRoleAccessAdminRoute,
    getAiUserOverrideAdminRoute,
    updateAiRoleAccessAdminRoute,
    updateAiUserOverrideAdminRoute,
    deleteAiUserOverrideAdminRoute,
    listAiHistoryAdminRoute,
    showAiRunAdminRoute,
    assistAiAdminRoute,
    assistStreamAiAdminRoute,
    estimateAiAdminRoute,
    availableAiActionsAdminRoute,
    aiFeedbackAdminRoute,
    getTranslationSourcesAdminRoute,
    saveTranslationSourcesAdminRoute,
  ],
});
