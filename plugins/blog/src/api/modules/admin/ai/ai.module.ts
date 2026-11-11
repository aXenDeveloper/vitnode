import { buildModule } from "@/api/builders";

import { translateAiAdminRoute } from "./routes/translate.route";

export const aiAdminModule = buildModule({
  name: "ai",
  routes: [translateAiAdminRoute],
});
