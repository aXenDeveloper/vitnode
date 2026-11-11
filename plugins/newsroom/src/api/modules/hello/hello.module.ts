import { buildModule } from "@/api/builders";

import { helloRoute } from "./routes/hello.route";

export const helloModule = buildModule({
  name: "hello",
  routes: [helloRoute],
});
