import {
  buildContentFrontendRegistry,
  setContentFrontendRegistry,
} from "@vitnode/core/content";

import { pluginContentTypes } from "#/content-registry.gen";


export const contentRegistry = buildContentFrontendRegistry(pluginContentTypes);

setContentFrontendRegistry(contentRegistry);
