import type {
  BlockComponent,
  BlockData,
  BlockDefinition,
  BlockFieldMap,
} from "./types";

import { assertBlockFields } from "./capabilities";
import { assertBlockName } from "./namespace";

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
}: DefineBlockArgs<TId, TFields>): BlockDefinition<TId, TFields> => {
  assertBlockName(id);

  return {
    component: component as BlockComponent,
    description,
    fields: assertBlockFields(id, fields),
    id,
    name,
  };
};
