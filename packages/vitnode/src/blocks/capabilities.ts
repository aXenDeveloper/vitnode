import type { ContentFieldKind, ContentFieldMap } from "../content/types";
import type { BlockFieldMap } from "./types";

import { contentInnerFields } from "../content/paths";
import { BlockError } from "./errors";

export const BLOCK_FIELD_KINDS = [
  "boolean",
  "dateTime",
  "enum",
  "group",
  "number",
  "text",
  "textarea",
] as const;

export type BlockFieldKind = (typeof BLOCK_FIELD_KINDS)[number];

const supported: ReadonlySet<string> = new Set(BLOCK_FIELD_KINDS);

export const isBlockFieldKind = (kind: string): kind is BlockFieldKind =>
  supported.has(kind);

const REFERENCE_LIFECYCLE =
  "a reference is a row identifier, and the record that owns it has to pin the row against deletion. A content column does that with a foreign key; a value inside a JSON document has nowhere to put one, so nothing would stop the referenced row being deleted while a published page still renders it";

const DEFERRED: Partial<Record<ContentFieldKind, string>> = {
  blocks:
    "nested blocks are a later stage: a block that contains a zone needs the zone's own allowlist, depth limits and cycle detection before it can be stored safely",
  file: `${REFERENCE_LIFECYCLE}. Supporting it means extracting the references out of a block's data on write and pinning them exactly as a \`file\` column is pinned, with \`ON DELETE RESTRICT\`, so the Files screen answers 409 instead of orphaning a page`,
  relation: `${REFERENCE_LIFECYCLE}. It also needs somewhere to honour \`onDelete\`, which for a column is the foreign key itself`,
  repeatable:
    "a repeatable's rows are rows on a generated child table, identified by a database id. A JSON document has no such rows - model the list with a group inside the block's own data once nested structures land",
  slug: "a slug is a record's address, and a block is not addressable on its own",
  user: `${REFERENCE_LIFECYCLE}. It also needs somewhere to honour \`onDelete\`, which for a column is the foreign key itself`,
};

export const blockFieldKindRefusal = (kind: string): null | string => {
  if (isBlockFieldKind(kind)) return null;

  const deferred = DEFERRED[kind as ContentFieldKind];

  return (
    deferred ??
    `"${kind}" is not a Content Engine field kind a block can hold. Supported kinds: ${BLOCK_FIELD_KINDS.join(", ")}`
  );
};

export const assertBlockFields = <TFields extends BlockFieldMap>(
  blockId: string,
  fields: TFields,
): TFields => {
  const names = Object.keys(fields);

  if (names.length === 0) {
    throw new BlockError(
      "A block needs at least one field. A block with no data is a component, not a block - render it directly.",
      { blockId },
    );
  }

  const map = fields as unknown as ContentFieldMap;

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

  return fields;
};

const assertBlockField = (
  blockId: string,
  name: string,
  fieldValue: { kind: string; localized?: boolean },
): void => {
  const refusal = blockFieldKindRefusal(fieldValue.kind);
  if (refusal !== null) {
    throw new BlockError(
      `Field "${name}" is a "${fieldValue.kind}" field, which a block cannot hold yet: ${refusal}. Supported kinds: ${BLOCK_FIELD_KINDS.join(", ")}.`,
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
