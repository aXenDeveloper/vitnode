import type { RegisteredFrontendContentType } from "@/content/index";
import type { ContentEditorialActionId } from "@/views/admin/views/content/actions/row-actions-model";
import type { ContentRowData } from "@/views/admin/views/content/table/cells";

import { CONTENT_EDITORIAL_ACTION_IDS } from "@/views/admin/views/content/actions/row-actions-model";

/**
 * The two things the Content Engine **list** does not implement, and the seam it
 * reaches them through.
 *
 * The list screen owns the table, the query, the URL contract, the create and
 * edit entry points, the `⋯` menu itself and the three writes that live on a row
 * - publish, unpublish and delete. It deliberately owns neither of these:
 *
 *     FormDialog   the create/edit form, for a dialog-mode content type
 *     rowPanels    revision history, delivery, preview, scheduling
 *
 * Both are large features with their own mutations, their own conflict handling
 * and their own screens, and a second copy of either would be behaviour that has
 * to stay identical to something it cannot see. So the list states exactly what
 * it needs - a trigger it can wrap, and a panel it can open by id - and nothing
 * more. Which actions a row offers, in what order, and whether they fit as
 * buttons is *not* delegated: that is `row-actions-model.ts`, so a registered
 * panel cannot change what the menu looks like.
 *
 * ## Why a module-scope registry rather than props
 *
 * The same reason `setContentFrontendRegistry` is one, one layer down. A content
 * screen is reached through a single splat route that a host application owns,
 * and threading components through it would put a decision about the *engine*
 * into every application's route file - where a new capability means every host
 * edits a file it should never have had to open.
 *
 * Module scope means *per bundle*: the browser has one instance and the server
 * has one, and each registers its own. Nothing per-request or per-administrator
 * is stored here, which is what makes a module-level value safe on a server
 * rendering many at once.
 *
 * ## Absent is a supported state, and it is visible in the menu
 *
 * An unregistered slot renders nothing rather than throwing, and an editorial
 * action whose panel nobody registered is **not offered** - a menu entry that
 * opens nothing is worse than an absent one. The list is still a working screen
 * without either: page-mode content types keep their create and edit pages, and
 * every content type keeps publish and delete.
 */

/** Everything a form dialog is told about what it is editing. */
export interface ContentFormDialogProps {
  action: "create" | "edit";
  /** The trigger the list renders - a button, already labelled and tooltipped. */
  children: React.ReactNode;
  /** The content type, with its definition and its component overrides. */
  entry: RegisteredFrontendContentType;
  /** The row being edited. Absent for `create`. */
  row?: ContentRowData;
  /** The content type's noun, as this administrator reads it. */
  singular: string;
  /** The record's resolved title, for the dialog heading. Absent for `create`. */
  title?: string;
}

/**
 * Everything one editorial panel is told, including how to close.
 *
 * The three control props are the row menu's, not the panel's: the menu decides
 * which panel is open, and `finalFocus` is where the keyboard goes when it
 * closes - the button that opened it, which is the only element still on screen
 * that the person was looking at.
 */
export interface ContentRowPanelProps {
  /** The version the row is at now, for a restore's precondition. */
  currentVersion: number;
  entry: RegisteredFrontendContentType;
  finalFocus: React.RefObject<HTMLElement | null>;
  itemId: number;
  /** The language the list is being read in, for a localized content type. */
  locale?: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  singular: string;
  title: string;
  /** The version to act on, for an editorial content type. */
  version?: number;
}

export type ContentRowPanel = (props: ContentRowPanelProps) => React.ReactNode;

export interface ContentAdminSlots {
  FormDialog?: (props: ContentFormDialogProps) => React.ReactNode;
  /** One panel per editorial action id. Anything absent is not offered. */
  rowPanels?: Partial<Record<ContentEditorialActionId, ContentRowPanel>>;
}

let registered: ContentAdminSlots = {};

/**
 * Registers what the list may mount, at module scope.
 *
 * Merged rather than replaced - `rowPanels` included - so the form module and
 * the editorial module can register independently and in either order, which is
 * what lets them be separate imports at all. Registering the same slot twice
 * replaces that one, because a hot reload re-evaluates the module and the newer
 * component is the right answer.
 */
export const setContentAdminSlots = (slots: ContentAdminSlots): void => {
  registered = {
    ...registered,
    ...slots,
    ...(slots.rowPanels
      ? { rowPanels: { ...registered.rowPanels, ...slots.rowPanels } }
      : {}),
  };
};

/** What is registered right now. Empty is a supported state. */
export const contentAdminSlots = (): ContentAdminSlots => registered;

/**
 * The editorial actions this host can actually open, for the shared model's
 * `renderable` list.
 *
 * `delete` is never in here and never needs to be: the list implements it
 * itself, so it is always renderable and the caller adds it.
 */
export const registeredContentRowPanels = (
  slots: ContentAdminSlots = registered,
): ContentEditorialActionId[] =>
  CONTENT_EDITORIAL_ACTION_IDS.filter(id => Boolean(slots.rowPanels?.[id]));
