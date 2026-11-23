import { buildModule } from "@/builders";

import { siteStatusRoute } from "./routes/status.route";

export const siteModule = buildModule({
  name: "site",
  routes: [siteStatusRoute],
});
