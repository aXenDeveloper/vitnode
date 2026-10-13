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
  enabled?: boolean;
  maxDepth?: number;
}

export interface ContentContainerOrderingInput {
  mode?: ContentContainerOrderingMode;
}

export interface ContentContainerPublicApiInput<
  TField extends string = string,
  TPath extends string = string,
> {
  fields?: readonly TField[];
  path: TPath;
}

export interface ContentContainerAdminInput {
  navigation?: boolean;
  path?: string;
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
