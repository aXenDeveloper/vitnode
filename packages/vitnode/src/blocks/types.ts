import type { ComponentType, ReactElement } from "react";

import type { ContentFieldMap, ContentValuesOf } from "../content/types";
import type {
  AREA_ALIGNS,
  AREA_COLUMNS,
  AREA_JUSTIFIES,
  AREA_LEGACY_SPACINGS,
  CONTENT_AREA_KIND,
} from "./const";

export type BlockFieldMap = Record<string, { kind: string }>;

/** A widget's data type, inferred from its field map. */
export type BlockData<TFields> = ContentValuesOf<TFields>;

export type BlockUnknownData = Record<string, unknown>;

export interface BlockVariantDefinition<TId extends string = string> {
  description?: string;
  /** Lowercase letters, digits and single hyphens. Stored in every instance that picks it, so keep it stable. */
  id: TId;
  label?: string;
}

export type AnyBlockVariantDefinition = BlockVariantDefinition;

/** Props of a widget's component. */
export interface BlockComponentProps<
  TData = BlockUnknownData,
  TVariant extends string = string,
> {
  /** The instance's own stable id, not the widget's type. */
  blockId: string;
  /** The stored data: validated when saved, shape-checked before render. Defaults are applied at write time only. */
  data: TData;
  /** Position among its siblings. */
  index: number;
  /** The qualified widget id, e.g. `"example:callout"`. */
  type: string;
  /** The look this instance picked, resolved against the declared variants; `undefined` for a widget with none. */
  variant?: TVariant;
}

export type BlockComponent<
  TData = BlockUnknownData,
  TVariant extends string = string,
> = ComponentType<BlockComponentProps<TData, TVariant>>;

export type BlockIcon = ComponentType<{ className?: string }>;

export interface BlockDefinition<
  TId extends string = string,
  TFields extends BlockFieldMap = ContentFieldMap,
  TVariant extends string = string,
> {
  /** Renders one instance. */
  component: BlockComponent;
  /** Variant used when an instance stores none. */
  defaultVariant?: TVariant;
  /** Shown in the Visual Editor's catalogue. */
  description?: string;
  /** Content Engine fields the data is validated and edited with. */
  fields: TFields;
  /** Icon component for the editor; a generic widget icon when missing. */
  icon?: BlockIcon;
  /** Name without a namespace; the registry stores it as `{namespace}:{id}`. */
  id: TId;
  /** Display name in the editor. */
  name?: string;
  /** Alternative looks for the same data. */
  variants?: readonly BlockVariantDefinition<TVariant>[];
}

export type AnyBlockDefinition = BlockDefinition;

/** One stored widget: `{ id, type, data, variant? }`. Create one with `createWidgetInstance`. */
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

export type BlockAreaAlign = (typeof AREA_ALIGNS)[number];

export type BlockAreaJustify = (typeof AREA_JUSTIFIES)[number];

export type AreaLegacySpacing = (typeof AREA_LEGACY_SPACINGS)[number];

export interface BlockAreaLayout {
  align?: BlockAreaAlign;
  columns: BlockAreaColumns;
  /** Pixels between the area's own children. */
  gap?: number;
  justify?: BlockAreaJustify;
  /** Pixels to the inline start and end of the area, outside its own grid. */
  marginX?: number;
  /** Pixels above and below the area, outside its own grid. */
  marginY?: number;
}

export type AreaStoredSpacing = AreaLegacySpacing | number;

export interface BlockAreaStoredLayout extends Omit<
  BlockAreaLayout,
  "gap" | "marginX" | "marginY"
> {
  gap?: AreaStoredSpacing;
  marginX?: AreaStoredSpacing;
  marginY?: AreaStoredSpacing;
}

/** A layout area grouping widgets in a grid, stored next to widget instances. */
export interface BlockAreaInstance {
  children: readonly AnyBlockInstance[];
  id: string;
  kind: typeof CONTENT_AREA_KIND;
  layout: BlockAreaStoredLayout;
}

export type ContentNode = AnyBlockInstance | BlockAreaInstance;

export type BlockAllowedEntry = string;

/**
 * Which widgets a zone accepts: `"*"` for all, or a list of qualified ids
 * (`"blog:latest-posts"`) and namespace wildcards (`"blog:*"`).
 */
export type BlockAllowedSpec = "*" | readonly BlockAllowedEntry[];

/**
 * A plugin's widgets, passed to `buildApiPlugin({ blocks })` and collected
 * into the app's generated registry. Export it from a module of its own so
 * the API and the browser register the same object.
 */
export interface BlockPluginSource {
  /** The plugin's widget definitions, from `defineWidget`. */
  blocks?: readonly AnyBlockDefinition[];
  /**
   * Overrides the id prefix, which defaults to the last segment of `pluginId`
   * (`@vitnode/blog` -> `blog`). Only needed when two plugins' names end the same.
   */
  namespace?: string;
  /** The plugin's id (`manifest.id`); must match the plugin passing it to `buildApiPlugin`. */
  pluginId: string;
}

export interface RegisteredBlock {
  definition: AnyBlockDefinition;
  namespace: string;
  pluginId: string;
  type: string;
}

/** Every installed widget by qualified id. Built by `createWidgetRegistry`. */
export interface BlockRegistry {
  all: () => readonly RegisteredBlock[];
  byNamespace: (namespace: string) => readonly RegisteredBlock[];
  get: (type: string) => RegisteredBlock | undefined;
  has: (type: string) => boolean;
  namespaces: () => readonly string[];
}

export type BlockRenderFallbackReason =
  | "invalid-data"
  | "not-allowed"
  | "unknown-type"
  | "unknown-variant";

export interface BlockRenderFallbackProps {
  instance: AnyBlockInstance;
  reason: BlockRenderFallbackReason;
}

/**
 * Whether rendering enforces a zone's allowlist and logs warnings. A data
 * shape check and skipping unknown types or variants always apply; full
 * validation happens on write.
 */
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
