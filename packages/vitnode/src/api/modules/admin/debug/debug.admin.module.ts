import { buildModule } from "../../../lib/module";
import { logsDebugAdminRoute } from "./routes/logs.route";

export const debugAdminModule = buildModule({
  name: "debug",
  routes: [logsDebugAdminRoute],
});
