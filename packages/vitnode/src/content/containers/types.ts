import type { z } from "zod";

import type {
  ContentBooleanField,
  ContentEnumField,
  ContentFieldValue,
  ContentNumberField,
  ContentTextareaField,
  ContentTextField,
  ContentValuesOf,
  Prettify,
} from "../types";
import type {
  CONTENT_CONTAINER_ERROR_CODES,
  CONTENT_CONTAINER_ORDERING_MODES,
} from "./const";

/** The field kinds a container definition may declare - single values, stored in `metadata`. */
export type ContentContainerFieldDescriptor =
  | ContentBooleanField
  | ContentEnumField
  | ContentNumberField
  | ContentTextareaField
  | ContentTextField;

export type ContentContainerFieldMap = Record<
  string,
  ContentContainerFieldDescriptor
>;

export type ContentContainerOrderingMode =
  (typeof CONTENT_CONTAINER_ORDERING_MODES)[number];

export type ContentContainerErrorCode =
  (typeof CONTENT_CONTAINER_ERROR_CODES)[number];

export interface ContentContainerHierarchyInput {
  /** `false` keeps every container at the root - a flat, ordered list. Defaults to `true`. */
  enabled?: boolean;
  /** How many levels deep the tree may go, roots included. Defaults to 5. */
  maxDepth?: number;
}

export interface ContentContainerOrderingInput {
  /**
   * `manual` keeps the order an admin drags siblings into. `alphabetical` sorts
   * siblings by name and turns reordering off - moving between parents still works.
   */
  mode?: ContentContainerOrderingMode;
}

export interface ContentContainerPublicApiInput<
  TField extends string = string,
  TPath extends string = string,
> {
  /**
   * Metadata fields the public API returns. `id`, `parentId`, `name`, `slug`,
   * `position` and `depth` are always public; anything else stays private
   * until it is listed here. There is no wildcard.
   */
  fields?: readonly TField[];
  /** One URL segment: `/api/{pluginId}/content/{path}`. Shares the namespace of content types' `publicApi.path`. */
  path: TPath;
}

export interface ContentContainerAdminInput {
  /** Show the screen in the AdminCP sidebar. Defaults to `true`. */
  navigation?: boolean;
  /** `/admin/containers/{path}`. Defaults to the id with dots turned into slashes. */
  path?: string;
  /** The staff permission module. Defaults to the id, snake_cased. */
  permissionModule?: string;
}

export interface ResolvedContentContainerPublicApi<
  TField extends string = string,
  TEnabled extends boolean = boolean,
  TPath extends string = string,
> {
  enabled: TEnabled;
  fields: TField[];
  path: TPath;
}

export interface ContentContainerSchemas {
  /** `{ name, slug?, parentId?, position?, metadata }` */
  create: z.ZodObject<z.ZodRawShape>;
  /** The definition's fields, as they are written. */
  metadata: z.ZodObject<z.ZodRawShape>;
  /** The definition's fields, every key optional - a partial update. */
  metadataPatch: z.ZodObject<z.ZodRawShape>;
  /** `{ parentId, position }` */
  move: z.ZodObject<z.ZodRawShape>;
  /** One container as the public API returns it: core columns plus `publicApi.fields`. */
  publicRecord: z.ZodObject<z.ZodRawShape>;
  /** One container as the AdminCP reads it: every column, every field. */
  record: z.ZodObject<z.ZodRawShape>;
  /** `{ name?, slug?, metadata? }` */
  update: z.ZodObject<z.ZodRawShape>;
}

export interface ContentContainerDefinition<
  TId extends string = string,
  TFields extends ContentContainerFieldMap = ContentContainerFieldMap,
  TPublicField extends string = string,
  TPublicEnabled extends boolean = boolean,
  TPublicPath extends string = string,
> {
  admin: {
    navigation: { enabled: boolean };
    path: string;
    permissionModule: string;
  };
  fields: TFields;
  hierarchy: { enabled: boolean; maxDepth: number };
  id: TId;
  /** Tells a container definition apart from a content type at runtime. */
  kind: "contentContainer";
  ordering: { mode: ContentContainerOrderingMode };
  publicApi: ResolvedContentContainerPublicApi<
    TPublicField,
    TPublicEnabled,
    TPublicPath
  >;
  schemas: ContentContainerSchemas;
}

export type AnyContentContainerDefinition = ContentContainerDefinition;

type FieldsOf<TDefinition> = TDefinition extends {
  fields: infer TFields extends ContentContainerFieldMap;
}
  ? TFields
  : ContentContainerFieldMap;

type PublicFieldsOf<TDefinition> = TDefinition extends {
  publicApi: { fields: (infer TField extends string)[] };
}
  ? TField
  : never;

/**
 * A container's own values. Every declared field is present - one that was
 * never written reads as `null` - so a reader never has to tell "missing" from
 * "empty".
 */
export type ContentContainerMetadata<TDefinition> = Prettify<{
  [K in keyof FieldsOf<TDefinition>]: ContentFieldValue<
    FieldsOf<TDefinition>[K]
  > | null;
}>;

export type ContentContainerMetadataInput<TDefinition> = ContentValuesOf<
  FieldsOf<TDefinition>
>;

export type ContentContainerPublicMetadata<TDefinition> = Prettify<
  Pick<
    ContentContainerMetadata<TDefinition>,
    keyof ContentContainerMetadata<TDefinition> & PublicFieldsOf<TDefinition>
  >
>;

interface ContentContainerColumns {
  /** 1 for a root, 2 for its children, and so on. */
  depth: number;
  id: number;
  name: string;
  parentId: null | number;
  /** Zero-based, among siblings. */
  position: number;
  slug: string;
}

export type ContentContainerRecord<
  TDefinition = AnyContentContainerDefinition,
> = Prettify<
  ContentContainerColumns & {
    createdAt: Date;
    metadata: ContentContainerMetadata<TDefinition>;
    updatedAt: Date;
  }
>;

export type ContentContainerPublicRecord<
  TDefinition = AnyContentContainerDefinition,
> = Prettify<
  ContentContainerColumns & {
    metadata: ContentContainerPublicMetadata<TDefinition>;
  }
>;

export interface ContentContainerCreateInput<
  TDefinition = AnyContentContainerDefinition,
> {
  metadata?: ContentContainerMetadataInput<TDefinition>;
  name: string;
  /** `null` or omitted for a root. */
  parentId?: null | number;
  /** Zero-based index among the new siblings. Omitted, the container goes last. */
  position?: number;
  /** Derived from `name` when omitted. */
  slug?: string;
}

export interface ContentContainerUpdateInput<
  TDefinition = AnyContentContainerDefinition,
> {
  metadata?: Partial<ContentContainerMetadataInput<TDefinition>>;
  name?: string;
  slug?: string;
}

export interface ContentContainerMoveInput {
  /** `null` moves the container to the root. */
  parentId: null | number;
  /** Zero-based index among the new siblings, after the container has left its old place. */
  position: number;
}
