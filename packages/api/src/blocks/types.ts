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

/**
 * The server-safe half of a widget: its id, Content Engine fields and variants
 * - everything the API validates, defaults and stores. Declare one with
 * `defineWidgetSchema` and register it on the API with
 * `buildApiPlugin({ blocks })`; the frontend's `defineWidget` adds the React
 * component under the same id.
 */
export interface BlockSchemaDefinition<
  TId extends string = string,
  TFields extends BlockFieldMap = ContentFieldMap,
  TVariant extends string = string,
> {
  /** Variant used when an instance stores none. */
  defaultVariant?: TVariant;
  /** Shown in the Visual Editor's catalogue. */
  description?: string;
  /** Content Engine fields the data is validated and edited with. */
  fields: TFields;
  /** Name without a namespace; the registry stores it as `{namespace}:{id}`. */
  id: TId;
  /** Display name in the editor. */
  name?: string;
  /** Alternative looks for the same data. */
  variants?: readonly BlockVariantDefinition<TVariant>[];
}

export type AnyBlockSchemaDefinition = BlockSchemaDefinition;

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
export interface BlockPluginSource<
  TDefinition extends AnyBlockSchemaDefinition = AnyBlockSchemaDefinition,
> {
  /**
   * The plugin's widgets: schemas from `defineWidgetSchema` on the API, full
   * definitions from `defineWidget` (which carry the component) in the browser.
   */
  blocks?: readonly TDefinition[];
  /**
   * Overrides the id prefix, which defaults to the last segment of `pluginId`
   * (`@vitnode/blog` -> `blog`). Only needed when two plugins' names end the same.
   */
  namespace?: string;
  /** The plugin's id (`manifest.id`); must match the plugin passing it to `buildApiPlugin`. */
  pluginId: string;
}

export interface RegisteredBlock<
  TDefinition extends AnyBlockSchemaDefinition = AnyBlockSchemaDefinition,
> {
  definition: TDefinition;
  namespace: string;
  pluginId: string;
  type: string;
}

/** Every installed widget by qualified id. Built by `createWidgetRegistry`. */
export interface BlockRegistry<
  TDefinition extends AnyBlockSchemaDefinition = AnyBlockSchemaDefinition,
> {
  all: () => readonly RegisteredBlock<TDefinition>[];
  byNamespace: (namespace: string) => readonly RegisteredBlock<TDefinition>[];
  get: (type: string) => RegisteredBlock<TDefinition> | undefined;
  has: (type: string) => boolean;
  namespaces: () => readonly string[];
}

export interface ContentZoneDefinition {
  allowedBlocks?: BlockAllowedSpec;
  id: string;
}

export interface ParsedContentZoneId {
  name: string;
  scope: string | undefined;
}
