export { createContentEditorAdapter, EditablePageSaveRefused } from "./adapter";
export {
  EDITABLE_PAGE_ID_MAX_LENGTH,
  EDITABLE_PAGE_ID_PATTERN,
} from "@vitnode/api/content/editor/const";
export {
  assertEditablePageId,
  defineEditablePage,
  editablePageZone,
} from "@vitnode/api/content/editor/define";
export type {
  AnyEditablePageDefinition,
  EditablePageAdapterArgs,
  EditablePageDefinition,
  EditablePageLayoutPayload,
  EditablePagePermission,
  EditablePageSavePayload,
  EditablePageZone,
  EditablePageZoneInput,
  EditablePageZoneProps,
} from "@vitnode/api/content/editor/types";
