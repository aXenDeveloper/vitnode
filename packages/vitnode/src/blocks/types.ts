import type { ComponentType, ReactElement } from "react";

import type { ContentFieldMap, ContentValuesOf } from "../content/types";

export type BlockFieldMap = Record<string, { kind: string }>;

export type BlockData<TFields> = ContentValuesOf<TFields>;

export type BlockUnknownData = Record<string, unknown>;

export interface BlockComponentProps<TData = BlockUnknownData> {
  blockId: string;
  data: TData;
  index: number;
  type: string;
}

export type BlockComponent<TData = BlockUnknownData> = ComponentType<
  BlockComponentProps<TData>
>;

export interface BlockDefinition<
  TId extends string = string,
  TFields extends BlockFieldMap = ContentFieldMap,
> {
  component: BlockComponent;
  description?: string;
  fields: TFields;
  id: TId;
  name?: string;
}

export type AnyBlockDefinition = BlockDefinition;

export interface BlockInstance<
  TType extends string = string,
  TData = BlockUnknownData,
> {
  data: TData;
  id: string;
  type: TType;
}

export type AnyBlockInstance = BlockInstance;

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

export interface BlockRenderFallbackProps {
  instance: AnyBlockInstance;
  reason: "invalid-data" | "unknown-type";
}

export type BlockValidationMode = "always" | "development" | "never";

export type BlockRenderFallback = (
  props: BlockRenderFallbackProps,
) => null | ReactElement;
