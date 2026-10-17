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
import type { ResolvedContentContainerPolicies } from "./policies";

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
  /** Containers may nest under a parent. Defaults to `true`. */
  enabled?: boolean;
  /** Deepest nesting level. Defaults to 5; `1` without a hierarchy. */
  maxDepth?: number;
}

export interface ContentContainerOrderingInput {
  /** `"manual"` (default, drag to reorder) or `"alphabetical"`. */
  mode?: ContentContainerOrderingMode;
}

export interface ContentContainerPublicApiInput<
  TField extends string = string,
  TPath extends string = string,
> {
  /** Metadata fields exposed publicly, besides name and slug. Defaults to none. */
  fields?: readonly TField[];
  /** The public module segment, e.g. `"forums"`. */
  path: TPath;
}

export interface ContentContainerAdminInput {
  /** Show the containers screen in the AdminCP sidebar. Defaults to `true`. */
  navigation?: boolean;
  /** The AdminCP path under `/admin/content/`. Defaults to the id with dots as slashes. */
  path?: string;
  /** Staff permission module. Defaults to the id in snake_case, e.g. `forum_forums`. */
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
  create: z.ZodObject<z.ZodRawShape>;
  metadata: z.ZodObject<z.ZodRawShape>;
  metadataPatch: z.ZodObject<z.ZodRawShape>;
  move: z.ZodObject<z.ZodRawShape>;
  publicRecord: z.ZodObject<z.ZodRawShape>;
  record: z.ZodObject<z.ZodRawShape>;
  update: z.ZodObject<z.ZodRawShape>;
}

/** A resolved container collection, returned by `defineContentContainer()`. */
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
  kind: "contentContainer";
  ordering: { mode: ContentContainerOrderingMode };
  policies: ResolvedContentContainerPolicies;
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
  depth: number;
  id: number;
  name: string;
  parentId: null | number;
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
  parentId?: null | number;
  position?: number;
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
  parentId: null | number;
  position: number;
}
