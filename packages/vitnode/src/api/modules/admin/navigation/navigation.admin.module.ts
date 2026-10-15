import { buildModule } from "@/api/builders";

import { createNavigationAdminRoute } from "./routes/create.route";
import { deleteNavigationAdminRoute } from "./routes/delete.route";
import { listNavigationAdminRoute } from "./routes/list.route";
import { presetsNavigationAdminRoute } from "./routes/presets.route";
import { reorderNavigationAdminRoute } from "./routes/reorder.route";
import { updateNavigationAdminRoute } from "./routes/update.route";

export const navigationAdminModule = buildModule({
  name: "navigation",
  routes: [
    listNavigationAdminRoute,
    presetsNavigationAdminRoute,
    createNavigationAdminRoute,
    reorderNavigationAdminRoute,
    updateNavigationAdminRoute,
    deleteNavigationAdminRoute,
  ],
});
