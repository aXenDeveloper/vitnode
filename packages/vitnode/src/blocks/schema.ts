import type { z } from "zod";

import type { ContentFieldMap } from "../content/types";
import type { BlockFieldMap } from "./types";

import { contentInnerFields } from "../content/paths";
import { contentFieldValuesObject } from "../content/schemas";
import { BLOCK_FIELD_KINDS, isBlockFieldKind } from "./const";
import { BlockError } from "./errors";

const assertBlockField = (
  blockId: string,
  name: string,
  fieldValue: { kind: string; localized?: boolean },
): void => {
  if (!isBlockFieldKind(fieldValue.kind)) {
    throw new BlockError(
      `Field "${name}" is a "${fieldValue.kind}" field, which a block cannot hold. A block's data is one JSON value stored inside the record that owns it, so it has no columns, no junction tables and no foreign keys to pin a reference with. Allowed kinds: ${BLOCK_FIELD_KINDS.join(", ")}.`,
      { blockId },
    );
  }

  if (fieldValue.localized === true) {
    throw new BlockError(
      `Field "${name}" is \`localized: true\`. A block's fields are not columns, so there is no translation row for them to live in - localize the whole zone with \`field.blocks({ localized: true })\`, which gives each language its own blocks and its own order.`,
      { blockId },
    );
  }
};

export const assertBlockFields = (
  blockId: string,
  fields: BlockFieldMap,
): ContentFieldMap => {
  const names = Object.keys(fields);

  if (names.length === 0) {
    throw new BlockError(
      "A block needs at least one field. A block with no data is a component, not a block - render it directly.",
      { blockId },
    );
  }

  const map = fields as ContentFieldMap;

  for (const name of names) {
    const fieldValue = map[name];

    if (!fieldValue?.kind) {
      throw new BlockError(
        `Field "${name}" is not a field descriptor. Build it with \`field.text()\`, \`field.enum()\`, and so on.`,
        { blockId },
      );
    }

    assertBlockField(blockId, name, fieldValue);

    if (fieldValue.kind !== "group") continue;

    for (const [leaf, leafValue] of Object.entries(
      contentInnerFields(fieldValue),
    )) {
      assertBlockField(blockId, `${name}.${leaf}`, leafValue);
    }
  }

  return map;
};

export const buildBlockDataSchema = (
  fields: ContentFieldMap,
): z.ZodObject<z.ZodRawShape> => contentFieldValuesObject(fields);

export const blockDataIssues = (error: z.ZodError): string =>
  error.issues
    .map(issue => {
      const path = issue.path.join(".");

      return path === "" ? issue.message : `${path}: ${issue.message}`;
    })
    .join("; ");
