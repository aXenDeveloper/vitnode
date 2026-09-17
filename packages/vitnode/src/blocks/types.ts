import type { ComponentType, ReactElement } from "react";

import type { ContentFieldMap, ContentValuesOf } from "../content/types";
import type {
  AREA_ALIGNS,
  AREA_COLUMNS,
  AREA_GAPS,
  AREA_JUSTIFIES,
  CONTENT_AREA_KIND,
} from "./const";

export type BlockFieldMap = Record<string, { kind: string }>;

export type BlockData<TFields> = ContentValuesOf<TFields>;

export type BlockUnknownData = Record<string, unknown>;

export interface BlockVariantDefinition<TId extends string = string> {
  description?: string;
  id: TId;
  label?: string;
}

export type AnyBlockVariantDefinition = BlockVariantDefinition;

export interface BlockComponentProps<TData = BlockUnknownData> {
  blockId: string;
  data: TData;
  index: number;
  type: string;
  variant?: string;
}

export type BlockComponent<TData = BlockUnknownData> = ComponentType<
  BlockComponentProps<TData>
>;

export interface BlockDefinition<
  TId extends string = string,
  TFields extends BlockFieldMap = ContentFieldMap,
  TVariant extends string = string,
> {
  component: BlockComponent;
  defaultVariant?: TVariant;
  description?: string;
  fields: TFields;
  id: TId;
  name?: string;
  variants?: readonly BlockVariantDefinition<TVariant>[];
}

export type AnyBlockDefinition = BlockDefinition;

export interface BlockInstance<
  TType extends string = string,
  TData = BlockUnknownData,
  TVariant extends string = string,
> {
  data: TData;
  id: string;
  type: TType;
  variant?: TVariant;
}

export type AnyBlockInstance = BlockInstance;

export type BlockAreaColumns = (typeof AREA_COLUMNS)[number];

export type BlockAreaGap = (typeof AREA_GAPS)[number];

export type BlockAreaAlign = (typeof AREA_ALIGNS)[number];

export type BlockAreaJustify = (typeof AREA_JUSTIFIES)[number];

export interface BlockAreaLayout {
  align?: BlockAreaAlign;
  columns: BlockAreaColumns;
  gap?: BlockAreaGap;
  justify?: BlockAreaJustify;
}

export interface BlockAreaInstance {
  children: readonly AnyBlockInstance[];
  id: string;
  kind: typeof CONTENT_AREA_KIND;
  layout: BlockAreaLayout;
}

export type ContentNode = AnyBlockInstance | BlockAreaInstance;

export type BlockAllowedEntry = string;

export type BlockAllowedSpec = "*" | readonly BlockAllowedEntry[];

export interface BlockPluginSource {
  blocks?: readonly AnyBlockDefinition[];
  namespace?: string;
  pluginId: string;
}

export interface RegisteredBlock {
  definition: AnyBlockDefinition;
  namespace: string;
  pluginId: string;
  type: string;
}

export interface BlockRegistry {
  all: () => readonly RegisteredBlock[];
  byNamespace: (namespace: string) => readonly RegisteredBlock[];
  get: (type: string) => RegisteredBlock | undefined;
  has: (type: string) => boolean;
  namespaces: () => readonly string[];
}

export type BlockRenderFallbackReason =
  "invalid-data" | "not-allowed" | "unknown-type" | "unknown-variant";

export interface BlockRenderFallbackProps {
  instance: AnyBlockInstance;
  reason: BlockRenderFallbackReason;
}

export type BlockValidationMode = "always" | "development" | "never";

export type BlockRenderFallback = (
  props: BlockRenderFallbackProps,
) => null | ReactElement;

export interface ContentZoneDefinition {
  allowedBlocks?: BlockAllowedSpec;
  id: string;
}

export interface ParsedContentZoneId {
  name: string;
  scope: string | undefined;
}
