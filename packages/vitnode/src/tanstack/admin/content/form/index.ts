import { setContentAdminSlots } from "../slots";
import { ContentAdminFormDialog } from "./dialog";

/**
 * The Content Engine's create and edit forms, for a TanStack Start host.
 *
 *     ./transport   the writes, and what each one owes the query cache
 *     ./host        the two seams the shared form reads, wired to this router
 *     ./spec        one content type's form spec, built where the strings are
 *     ./dialog      dialog-mode presentation - the list's `FormDialog` slot
 *     ./form-body   what a dialog renders once it opens, behind `React.lazy`
 *     ./screen      page-mode presentation, and the loader it needs
 *     ./page-body   what a form *page* renders, behind `React.lazy` as well
 *     ./server      the two SSR reads a page-mode edit form is warmed with
 *
 * The form itself is not here and is not this module's: `ContentForm` and
 * everything under it - the AutoForm binding, the field components, the
 * conflict dialog, the translation diff, the collection reload, the version
 * precondition - is `views/admin/views/content/`, shared with the Next.js
 * AdminCP. What this namespace supplies is the two things that code takes as
 * arguments and neither host can decide for the other: how a mutation reaches
 * Hono, and what happens to the screen afterwards.
 *
 * ## Importing this module registers the dialog
 *
 * The list renders a create button and a row's pencil through
 * `contentAdminSlots().FormDialog`, and an unregistered slot renders nothing at
 * all. Registration is therefore a *side effect of importing this module*, which
 * is what makes it impossible to render the slot's consumer without it: the
 * screen composition imports `./screen` from here, so anything that can show a
 * content list has already run this line.
 *
 * The same shape `setContentFrontendRegistry` and `setAdminTransport` use, and
 * for the same reason - a module-scope slot filled by the import graph rather
 * than a prop threaded through a host's route file.
 */
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
