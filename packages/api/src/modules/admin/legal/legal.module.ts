import { buildModule } from "@/builders";

import { acceptancesLegalAdminRoute } from "./routes/acceptances.route";
import { createDraftLegalAdminRoute } from "./routes/create-draft.route";
import { deleteDraftLegalAdminRoute } from "./routes/delete-draft.route";
import { deliveriesLegalAdminRoute } from "./routes/deliveries.route";
import { draftLegalAdminRoute } from "./routes/draft.route";
import { emailPreviewLegalAdminRoute } from "./routes/email-preview.route";
import { overviewLegalAdminRoute } from "./routes/overview.route";
import { publishLegalAdminRoute } from "./routes/publish.route";
import { retryDeliveriesLegalAdminRoute } from "./routes/retry-deliveries.route";
import { updateDraftLegalAdminRoute } from "./routes/update-draft.route";
import { versionLegalAdminRoute } from "./routes/version.route";
import { versionsLegalAdminRoute } from "./routes/versions.route";

export const legalAdminModule = buildModule({
  name: "legal",
  routes: [
    overviewLegalAdminRoute,
    versionsLegalAdminRoute,
    versionLegalAdminRoute,
    draftLegalAdminRoute,
    createDraftLegalAdminRoute,
    updateDraftLegalAdminRoute,
    deleteDraftLegalAdminRoute,
    emailPreviewLegalAdminRoute,
    publishLegalAdminRoute,
    deliveriesLegalAdminRoute,
    retryDeliveriesLegalAdminRoute,
    acceptancesLegalAdminRoute,
  ],
});
