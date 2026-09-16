import type { z } from "zod";

import type {
  BlockComponent,
  BlockData,
  BlockDefinition,
  BlockFieldMap,
} from "./types";

import { BlockError } from "./errors";
import { assertBlockName } from "./namespace";
import {
  assertBlockFields,
  blockDataIssues,
  buildBlockDataSchema,
} from "./schema";

export interface DefineBlockArgs<
  TId extends string,
  TFields extends BlockFieldMap,
> {
  component: BlockComponent<BlockData<TFields>>;
  description?: string;
  fields: TFields;
  id: TId;
  name?: string;
}

export const defineBlock = <
  const TFields extends BlockFieldMap,
  TId extends string = string,
>({
  component,
  description,
  fields,
  id,
  name,
}: DefineBlockArgs<TId, TFields>): BlockDefinition<TId, BlockData<TFields>> => {
  assertBlockName(id);

  const map = assertBlockFields(id, fields);
  const schema = buildBlockDataSchema(map);

  return {
    component: component as BlockComponent,
    description,
    fields: map,
    id,
    name,
    parse: (value: unknown) => {
      const parsed: z.ZodSafeParseResult<unknown> = schema.safeParse(value);

      if (!parsed.success) {
        throw new BlockError(
          `Block data does not match the block's fields - ${blockDataIssues(parsed.error)}.`,
          { blockId: id },
        );
      }

      return parsed.data as BlockData<TFields>;
    },
    schema,
  };
};
