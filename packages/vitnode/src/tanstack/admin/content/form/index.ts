import { setContentAdminSlots } from "../slots";
import { ContentAdminFormDialog } from "./dialog";

setContentAdminSlots({ FormDialog: ContentAdminFormDialog });

export { ContentAdminFormDialog } from "./dialog";
export { ContentFormHost } from "./host";
export type { ContentFormScreenData } from "./route";
export { loadContentFormScreen } from "./route";
export type { ContentFormScreenProps } from "./screen";
export { ContentFormScreen } from "./screen";
export type { ContentTypeForm } from "./spec";
export { useContentTypeForm } from "./spec";
export { contentFormTransport } from "./transport";
