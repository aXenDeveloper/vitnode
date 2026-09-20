import type { BlockAllowedSpec, ContentNode } from "../../blocks/types";
import type {
  AnyEditablePageDefinition,
  EditablePageDefinition,
  EditablePagePermission,
  EditablePageZone,
  EditablePageZoneInput,
} from "./types";

import {
  contentNodeBlocks,
  isAreaLike,
  isBlockAreaInstance,
  isContentNode,
} from "../../blocks/area";
import {
  AREA_CHILDREN_DEFAULT_MAX,
  BLOCK_WILDCARD,
  CONTENT_BLOCKS_ABSOLUTE_MAX,
  CONTENT_BLOCKS_DEFAULT_MAX,
} from "../../blocks/const";
import { parseBlockId } from "../../blocks/namespace";
import { assertContentZoneId } from "../../blocks/zone-meta";
import { ContentEngineError } from "../errors";
import { EDITABLE_PAGE_ID_MAX_LENGTH, EDITABLE_PAGE_ID_PATTERN } from "./const";

const quoted = (values: readonly string[]): string =>
  values.map(value => JSON.stringify(value)).join(", ");

const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every(entry => typeof entry === "string");

export const assertEditablePageId = (pageId: unknown): string => {
  if (
    typeof pageId !== "string" ||
    pageId.length > EDITABLE_PAGE_ID_MAX_LENGTH ||
    !EDITABLE_PAGE_ID_PATTERN.test(pageId)
  ) {
    throw new ContentEngineError(
      `Editable page id ${JSON.stringify(pageId)} is not usable. It is \`plugin:page\` - two or more \`:\`-separated segments of lowercase letters, digits and single hyphens, up to ${EDITABLE_PAGE_ID_MAX_LENGTH} characters, as in "example:settings". Every stored layout row is keyed by it, so it is written once by hand and never generated.`,
    );
  }

  return pageId;
};

const assertZoneId = (pageId: string, zoneId: string): string => {
  try {
    return assertContentZoneId(zoneId);
  } catch (cause) {
    throw new ContentEngineError(
      cause instanceof Error
        ? cause.message
        : `Content zone id ${JSON.stringify(zoneId)} is not usable.`,
      { cause, contentTypeId: pageId },
    );
  }
};

const readPermission = (
  pageId: string,
  value: unknown,
): EditablePagePermission => {
  if (
    typeof value !== "object" ||
    value === null ||
    !("permission" in value) ||
    typeof value.permission !== "string" ||
    value.permission.length === 0 ||
    !("module" in value) ||
    typeof value.module !== "string" ||
    value.module.length === 0
  ) {
    throw new ContentEngineError(
      `Page ${JSON.stringify(pageId)} declares a \`permission\` that is not usable. It is \`{ module: "widgets", permission: "can_edit" }\` - the moderator permission a member needs before the editor offers to open, naming both the module the permission lives in and the permission itself. Ignoring it would let everyone who can read the page rewrite its layout, so it is refused instead.`,
      { contentTypeId: pageId },
    );
  }

  const plugin = "plugin" in value ? value.plugin : undefined;

  if (plugin !== undefined && (typeof plugin !== "string" || plugin === "")) {
    throw new ContentEngineError(
      `Page ${JSON.stringify(pageId)} declares a \`permission\` whose \`plugin\` is not a name. Leave it out and the page's own plugin is checked; name another one and it has to be a non-empty string, because dropping it would check a different plugin's module than the page meant.`,
      { contentTypeId: pageId },
    );
  }

  return {
    module: value.module,
    permission: value.permission,
    ...(plugin === undefined ? {} : { plugin }),
  };
};

const readAllowed = (
  pageId: string,
  zoneId: string,
  value: unknown,
): BlockAllowedSpec => {
  if (value === undefined || value === BLOCK_WILDCARD) return BLOCK_WILDCARD;

  if (!isStringArray(value)) {
    throw new ContentEngineError(
      `Zone ${JSON.stringify(zoneId)} declares an \`allowed\` that is not a block allowlist. It is \`["core:text"]\`, or \`"*"\` for every installed block. Falling back to \`"*"\` would open a zone whose author meant to narrow it, so it is refused instead.`,
      { contentTypeId: pageId },
    );
  }

  if (value.length === 0) {
    throw new ContentEngineError(
      `Zone ${JSON.stringify(zoneId)} allows no blocks at all, so nothing could ever be placed in it. Use \`allowed: "*"\`, or name the blocks it accepts.`,
      { contentTypeId: pageId },
    );
  }

  const malformed = value.find(
    entry => entry !== BLOCK_WILDCARD && parseBlockId(entry) === null,
  );

  if (malformed !== undefined) {
    throw new ContentEngineError(
      `Zone ${JSON.stringify(zoneId)} allows ${JSON.stringify(malformed)}, which is not a block id. Write "namespace:name", "namespace:*" or "*".`,
      { contentTypeId: pageId },
    );
  }

  return [...value];
};

const readCount = (
  pageId: string,
  zoneId: string,
  name: "max" | "min",
  value: unknown,
): number | undefined => {
  if (value === undefined) return undefined;

  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < (name === "max" ? 1 : 0) ||
    value > CONTENT_BLOCKS_ABSOLUTE_MAX
  ) {
    throw new ContentEngineError(
      `Zone ${JSON.stringify(zoneId)} declares a \`${name}\` of ${JSON.stringify(value)}. It counts blocks, so it is a whole number between ${name === "max" ? 1 : 0} and ${CONTENT_BLOCKS_ABSOLUTE_MAX}.`,
      { contentTypeId: pageId },
    );
  }

  return value;
};

const readDefault = (
  pageId: string,
  zoneId: string,
  value: unknown,
): readonly ContentNode[] => {
  if (value === undefined) return [];

  if (!Array.isArray(value)) {
    throw new ContentEngineError(
      `Zone ${JSON.stringify(zoneId)} declares a \`default\` that is not a list. A shipped default is the list of nodes the zone renders until somebody saves one of their own.`,
      { contentTypeId: pageId },
    );
  }

  const at = value.findIndex(node => !isContentNode(node));

  if (at !== -1) {
    throw new ContentEngineError(
      `Zone ${JSON.stringify(zoneId)} has a \`default\` whose entry ${at} is neither a block nor an area. A shipped default is rendered as stored content and is what a reset restores to, so it holds real nodes - \`{ id, type, data }\` for a block, \`{ id, kind: "area", layout, children }\` for an area.`,
      { contentTypeId: pageId },
    );
  }

  const nodes = value as readonly ContentNode[];
  const seen = new Set<string>();

  for (const node of nodes) {
    if (seen.has(node.id)) {
      throw new ContentEngineError(
        `Zone ${JSON.stringify(zoneId)} has a \`default\` that uses the instance id ${JSON.stringify(node.id)} more than once. Every node carries its own id, and a save is refused when two share one - so the default is refused now instead.`,
        { contentTypeId: pageId },
      );
    }
    seen.add(node.id);

    if (!isBlockAreaInstance(node)) continue;

    if (node.children.length > AREA_CHILDREN_DEFAULT_MAX) {
      throw new ContentEngineError(
        `Zone ${JSON.stringify(zoneId)} has a \`default\` whose area ${JSON.stringify(node.id)} holds ${node.children.length} children, and an area holds at most ${AREA_CHILDREN_DEFAULT_MAX}. A save is refused past that, so the default is refused now instead.`,
        { contentTypeId: pageId },
      );
    }

    for (const child of node.children) {
      if (isAreaLike(child)) {
        throw new ContentEngineError(
          `Zone ${JSON.stringify(zoneId)} has a \`default\` whose area ${JSON.stringify(node.id)} holds another area. One level of columns is what the stored document stays unambiguous under, so a save is refused - and the default is refused now instead.`,
          { contentTypeId: pageId },
        );
      }

      if (seen.has(child.id)) {
        throw new ContentEngineError(
          `Zone ${JSON.stringify(zoneId)} has a \`default\` that uses the instance id ${JSON.stringify(child.id)} more than once. Every node carries its own id, and a save is refused when two share one - so the default is refused now instead.`,
          { contentTypeId: pageId },
        );
      }
      seen.add(child.id);
    }
  }

  return nodes;
};

const readZone = (
  pageId: string,
  zoneId: string,
  input: unknown,
): EditablePageZone => {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new ContentEngineError(
      `Zone ${JSON.stringify(zoneId)} is not declared with an object. A zone is \`{ allowed, min, max, default }\`, and \`{}\` is enough when it takes every installed block.`,
      { contentTypeId: pageId },
    );
  }

  const declared = input as Partial<
    Record<keyof EditablePageZoneInput, unknown>
  >;
  const allowed = readAllowed(pageId, zoneId, declared.allowed);
  const max = readCount(pageId, zoneId, "max", declared.max);
  const min = readCount(pageId, zoneId, "min", declared.min);
  const shipped = readDefault(pageId, zoneId, declared.default);

  const ceiling = max ?? CONTENT_BLOCKS_DEFAULT_MAX;

  if (min !== undefined && min > ceiling) {
    throw new ContentEngineError(
      max === undefined
        ? `Zone ${JSON.stringify(zoneId)} has a min of ${min}, and a zone stores at most ${CONTENT_BLOCKS_DEFAULT_MAX} blocks unless it raises \`max\` itself. No list of blocks could satisfy both.`
        : `Zone ${JSON.stringify(zoneId)} has min ${min} greater than max ${max}, so no list of blocks could ever satisfy it.`,
      { contentTypeId: pageId },
    );
  }

  const shippedBlocks = contentNodeBlocks(shipped).length;

  if (shipped.length > CONTENT_BLOCKS_ABSOLUTE_MAX) {
    throw new ContentEngineError(
      `Zone ${JSON.stringify(zoneId)} ships ${shipped.length} nodes by default, and a zone stores at most ${CONTENT_BLOCKS_ABSOLUTE_MAX} of them whatever its own \`max\` says.`,
      { contentTypeId: pageId },
    );
  }

  if (shippedBlocks > ceiling) {
    throw new ContentEngineError(
      `Zone ${JSON.stringify(zoneId)} ships ${shippedBlocks} blocks by default, which is more than the ${ceiling} it allows. An area is not counted, the blocks inside it are - the same way a save counts them. The first Save would be refused, so the default is refused now instead.`,
      { contentTypeId: pageId },
    );
  }

  if (min !== undefined && shippedBlocks < min) {
    throw new ContentEngineError(
      `Zone ${JSON.stringify(zoneId)} ships ${shippedBlocks} blocks by default, which is fewer than the ${min} it requires. An area is not counted, the blocks inside it are - the same way a save counts them. The zone is served with its default until somebody saves one of their own, and that default would be refused the moment they did - so it is refused now instead.`,
      { contentTypeId: pageId },
    );
  }

  return { allowed, default: shipped, max, min, zoneId };
};

export const editablePageZone = (
  page: AnyEditablePageDefinition,
  zoneId: string,
): EditablePageZone => {
  const found = Object.hasOwn(page.zones, zoneId)
    ? page.zones[zoneId]
    : undefined;

  if (found === undefined) {
    throw new ContentEngineError(
      `Page ${JSON.stringify(page.id)} has no zone ${JSON.stringify(zoneId)}. It declares ${quoted(page.zoneIds)}. A zone the page does not declare has nowhere to be stored, so it is refused rather than rendered as a zone every Save would skip.`,
      { contentTypeId: page.id },
    );
  }

  return found;
};

export const defineEditablePage = <const TZoneId extends string>(args: {
  id: string;
  permission: EditablePagePermission;
  zones: Record<TZoneId, EditablePageZoneInput>;
}): EditablePageDefinition<TZoneId> => {
  const pageId = assertEditablePageId(args.id);
  const permission = readPermission(pageId, args.permission);
  const declared: Record<string, unknown> = args.zones;
  const entries = Object.entries(declared);

  if (entries.length === 0) {
    throw new ContentEngineError(
      `Page ${JSON.stringify(pageId)} declares no zones. A page is editable because it has somewhere to put a block, so at least one zone is required.`,
      { contentTypeId: pageId },
    );
  }

  const zones: Record<string, EditablePageZone> = {};

  for (const [rawZoneId, input] of entries) {
    const zoneId = assertZoneId(pageId, rawZoneId);

    zones[zoneId] = readZone(pageId, zoneId, input);
  }

  const definition: EditablePageDefinition<TZoneId> = {
    id: pageId,
    permission,
    zone: zoneId => {
      const found = editablePageZone(definition, zoneId);

      return { allowedBlocks: found.allowed, id: found.zoneId };
    },
    zoneIds: Object.keys(zones),
    zones,
  };

  return definition;
};
