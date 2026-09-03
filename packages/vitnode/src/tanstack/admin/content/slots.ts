import type { RegisteredFrontendContentType } from "@/content/index";
import type { ContentEditorialActionId } from "@/views/admin/views/content/actions/row-actions-model";
import type { ContentRowData } from "@/views/admin/views/content/table/cells";

import { CONTENT_EDITORIAL_ACTION_IDS } from "@/views/admin/views/content/actions/row-actions-model";

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

export const registeredContentRowPanels = (
  slots: ContentAdminSlots = registered,
): ContentEditorialActionId[] =>
  CONTENT_EDITORIAL_ACTION_IDS.filter(id => Boolean(slots.rowPanels?.[id]));
