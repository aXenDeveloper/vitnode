import { buildModule } from "@/api/builders";

import { excerptAiAdminRoute } from "./routes/excerpt.route";
import { translateAiAdminRoute } from "./routes/translate.route";

export const aiAdminModule = buildModule({
  name: "ai",
  routes: [translateAiAdminRoute, excerptAiAdminRoute],
});
