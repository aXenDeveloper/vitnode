import type { DefineBlockSchemaArgs } from "@vitnode/api/blocks/define";

import { defineBlockSchema } from "@vitnode/api/blocks/define";

import type {
  BlockComponent,
  BlockData,
  BlockDefinition,
  BlockFieldMap,
  BlockIcon,
} from "./types";

/** What {@link defineBlock} (exported as `defineWidget`) takes. */
export interface DefineBlockArgs<
  TId extends string,
  TFields extends BlockFieldMap,
  TVariant extends string = string,
> extends DefineBlockSchemaArgs<TId, TFields, TVariant> {
  /** Renders one instance; `data` is as stored - validated on write and shape-checked before render. */
  component: BlockComponent<BlockData<TFields>, TVariant>;
  /** Icon component (not an element) for the editor; defaults to a generic widget icon. */
  icon?: BlockIcon;
}

/**
 * Declares a widget: an id, Content Engine fields and one React component. The
 * data type is inferred from `fields` (`WidgetData<typeof fields>`).
 *
 * The id, fields and variants are checked by `defineWidgetSchema` from
 * `@vitnode/api/blocks` - the half the API registers. Spread a schema the API
 * already uses into `defineWidget` to keep both sides on one definition.
 *
 * Universal and validation-free at render time - the data schema is derived
 * on demand by `parseWidgetData` / `widgetDataSchema`.
 *
 * @throws {BlockError} For an invalid or namespaced `id`, an unsupported
 * field kind, invalid or duplicate variant ids, an empty `variants`, or a
 * `defaultVariant` that is not declared.
 *
 * @example
 * ```tsx
 * import { defineWidgetSchema } from "@vitnode/api/blocks";
 * import { field } from "@vitnode/core/content";
 * import { defineWidget, type WidgetComponentProps, type WidgetData } from "@vitnode/core/widgets";
 *
 * // widgets/callout.schema.ts - registered on the API
 * export const calloutSchema = defineWidgetSchema({
 *   id: "callout",
 *   name: "Callout",
 *   fields: { title: field.text({ required: true, maxLength: 120 }) },
 * });
 *
 * // widgets/callout.tsx - registered in the browser
 * const Callout = ({ data }: WidgetComponentProps<WidgetData<typeof calloutSchema.fields>>) => (
 *   <aside>{data.title}</aside>
 * );
 *
 * export const calloutWidget = defineWidget({ ...calloutSchema, component: Callout });
 * ```
 */
export const defineBlock = <
  const TFields extends BlockFieldMap,
  TId extends string = string,
  TVariant extends string = string,
>({
  component,
  icon,
  ...schema
}: DefineBlockArgs<TId, TFields, TVariant>): BlockDefinition<
  TId,
  TFields,
  TVariant
> => ({
  ...defineBlockSchema<TFields, TId, TVariant>(schema),
  component: component as BlockComponent,
  icon,
});
