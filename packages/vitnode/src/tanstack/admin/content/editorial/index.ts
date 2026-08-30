import { setContentAdminSlots } from "../slots";
import { contentEditorialRowPanels } from "./panels";

/**
 * The Content Engine's editorial panels, registered for a TanStack Start host.
 *
 *     ./panels     the four slot components, each wrapped in its own host
 *     ./host       the transport and navigation providers a panel reads
 *     ./transport  the requests, and what each write expires
 *
 * Importing this module *is* the registration, exactly as importing `../form`
 * registers the form dialog. `../screen.tsx` imports both, and it is the one
 * module every content URL goes through - so a host route file stays topology
 * and never has to know these features exist.
 *
 * An unregistered panel is a supported state and a visible one: the row menu
 * intersects `row-actions-model`'s answer with `registeredContentRowPanels`, so
 * an application that does not import this gets a working list with publish,
 * edit and delete and no dead menu entries.
 */
setContentAdminSlots({ rowPanels: contentEditorialRowPanels });

export { ContentEditorialHost } from "./host";
export { contentEditorialRowPanels } from "./panels";
export { contentEditorialTransport } from "./transport";
