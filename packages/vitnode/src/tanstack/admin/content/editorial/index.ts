import { setContentAdminSlots } from "../slots";
import { contentEditorialRowPanels } from "./panels";

setContentAdminSlots({ rowPanels: contentEditorialRowPanels });

export { ContentEditorialHost } from "./host";
export { contentEditorialRowPanels } from "./panels";
export { contentEditorialTransport } from "./transport";
