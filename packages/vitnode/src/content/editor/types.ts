import type { BlockAllowedSpec, ContentNode } from "../../blocks/types";

export interface EditablePagePermission {
  module: string;
  permission: string;
  plugin?: string;
}

export interface EditablePageZoneInput {
  allowed?: BlockAllowedSpec;
  default?: readonly ContentNode[];
  max?: number;
  min?: number;
}

export interface EditablePageZone {
  allowed: BlockAllowedSpec;
  default: readonly ContentNode[];
  max: number | undefined;
  min: number | undefined;
  zoneId: string;
}

export interface EditablePageZoneProps {
  allowedBlocks: BlockAllowedSpec;
  id: string;
}

export interface EditablePageDefinition<TZoneId extends string = string> {
  id: string;
  permission: EditablePagePermission;
  zone: (zoneId: TZoneId) => EditablePageZoneProps;
  zoneIds: readonly string[];
  zones: Readonly<Record<string, EditablePageZone>>;
}

export type AnyEditablePageDefinition = EditablePageDefinition<never>;

export interface EditablePageSavePayload {
  expectedZones: Record<string, ContentNode[]>;
  pageId: string;
  zones: Record<string, ContentNode[]>;
}

export interface EditablePageLayoutPayload {
  pageId: string;
  updatedAt: null | string;
  zones: Record<string, ContentNode[]>;
}

export interface EditablePageAdapterArgs {
  page: AnyEditablePageDefinition;
  save: (
    payload: EditablePageSavePayload,
  ) => Promise<EditablePageLayoutPayload>;
}
