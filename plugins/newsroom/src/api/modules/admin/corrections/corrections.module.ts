import { buildModule } from "@/api/builders";

import { createCorrectionRoute } from "./routes/create.route";

export const adminCorrectionsModule = buildModule({
  name: "corrections",
  routes: [createCorrectionRoute],
});
