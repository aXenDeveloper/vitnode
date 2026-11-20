import { buildModule } from "@/builders";

import { createReactionAdminRoute } from "./routes/create.route";
import {
  deleteReactionAdminRoute,
  reactionDeleteImpactAdminRoute,
} from "./routes/delete.route";
import { listReactionsAdminRoute } from "./routes/list.route";
import { recountReputationAdminRoute } from "./routes/recount.route";
import { reorderReactionsAdminRoute } from "./routes/reorder.route";
import {
  showRoleReactionsAdminRoute,
  updateRoleReactionsAdminRoute,
} from "./routes/role.route";
import { updateReactionAdminRoute } from "./routes/update.route";
import { uploadReactionImageAdminRoute } from "./routes/upload.route";

export const reactionsAdminModule = buildModule({
  name: "reactions",
  routes: [
    listReactionsAdminRoute,
    createReactionAdminRoute,
    reorderReactionsAdminRoute,
    uploadReactionImageAdminRoute,
    recountReputationAdminRoute,
    showRoleReactionsAdminRoute,
    updateRoleReactionsAdminRoute,
    reactionDeleteImpactAdminRoute,
    updateReactionAdminRoute,
    deleteReactionAdminRoute,
  ],
});
