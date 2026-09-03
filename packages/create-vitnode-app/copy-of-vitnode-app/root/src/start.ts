import { createVitNodeStart } from "@vitnode/core/tanstack/start";

import { vitNodeConfig } from "#/vitnode.config";

export const startInstance = createVitNodeStart({ config: vitNodeConfig });
