import { buildModule } from "@/api/builders";

import { helloRoute } from "./hello.route";

export const helloModule = buildModule({
  name: "hello",
  routes: [helloRoute],
});
