import { z } from "zod";

import type {
  AnyBlockInstance,
  BlockAllowedSpec,
  BlockRegistry,
  ContentNode,
} from "./types";

import { contentNodeBlocks, isAreaLike } from "./area";
import {
  AREA_ALIGNS,
  AREA_CHILDREN_DEFAULT_MAX,
  AREA_COLUMNS,
  AREA_GAPS,
  AREA_JUSTIFIES,
  BLOCK_INSTANCE_ID_MAX_LENGTH,
  BLOCK_INSTANCE_ID_PATTERN,
  BLOCK_VARIANT_ID_MAX_LENGTH,
  CONTENT_AREA_KIND,
  CONTENT_BLOCKS_ABSOLUTE_MAX,
  CONTENT_BLOCKS_DEFAULT_MAX,
} from "./const";
import { isBlockAllowed, resolveBlockRegistry } from "./registry";
import { blockDataIssues, safeParseBlockData } from "./schema";
import { blockVariants, resolveBlockVariant } from "./variant";

export type ContentNodePath = (number | string)[];

export interface BlockInstanceIssue {
  index: number;
  message: string;
  path: ContentNodePath;
  type: string;
}

export interface BlockInstancesResult {
  instances: ContentNode[];
  issues: BlockInstanceIssue[];
}

const zodInstanceId = z
  .string()
  .max(BLOCK_INSTANCE_ID_MAX_LENGTH)
  .regex(
    BLOCK_INSTANCE_ID_PATTERN,
    "A block instance id is 1-64 characters of letters, digits, hyphens or underscores.",
  );

const zodBlockEnvelope = z.strictObject({
  data: z.record(z.string(), z.unknown()),
  id: zodInstanceId,
  type: z.string(),
  variant: z.string().max(BLOCK_VARIANT_ID_MAX_LENGTH).optional(),
});

const zodAreaLayout = z.strictObject({
  align: z.enum(AREA_ALIGNS).optional(),
  columns: z.literal(AREA_COLUMNS),
  gap: z.enum(AREA_GAPS).optional(),
  justify: z.enum(AREA_JUSTIFIES).optional(),
});

const areaShape = {
  id: zodInstanceId,
  kind: z.literal(CONTENT_AREA_KIND),
  layout: zodAreaLayout,
};

const zodAreaEnvelope = z.strictObject({
  ...areaShape,
  children: z.array(z.unknown()).max(AREA_CHILDREN_DEFAULT_MAX),
});

export const zodContentNode: z.ZodType<ContentNode> = z.union([
  z.strictObject({
    ...areaShape,
    children: z.array(zodBlockEnvelope).max(AREA_CHILDREN_DEFAULT_MAX),
  }),
  zodBlockEnvelope,
]);

export type BlockEnvelope = z.infer<typeof zodBlockEnvelope>;

const NESTED_AREA =
  "An area cannot hold another area. One level of columns is what the stored document and the editor's drop targets both stay unambiguous under - put the block in the outer area instead.";

const namedType = (value: unknown): string => {
  const type = (value as null | { type?: unknown })?.type;

  return typeof type === "string" ? type : "";
};

export const parseContentNodes = ({
  allowed,
  envelopes,
  registry,
}: {
  allowed: BlockAllowedSpec;
  envelopes: readonly unknown[];
  registry: BlockRegistry;
}): BlockInstancesResult => {
  const instances: ContentNode[] = [];
  const issues: BlockInstanceIssue[] = [];
  const seen = new Set<string>();

  const refuse = (
    path: ContentNodePath,
    type: string,
    message: string,
  ): undefined => {
    issues.push({ index: Number(path[0]), message, path, type });

    return undefined;
  };

  const parseBlock = (
    value: unknown,
    path: ContentNodePath,
  ): AnyBlockInstance | undefined => {
    const envelope = zodBlockEnvelope.safeParse(value);
    if (!envelope.success) {
      return refuse(
        path,
        namedType(value),
        `This is not a stored block - ${blockDataIssues(envelope.error)}.`,
      );
    }

    const { id, type, variant } = envelope.data;

    if (seen.has(id)) {
      return refuse(
        path,
        type,
        `Block instance id "${id}" appears more than once. Every instance needs its own stable id.`,
      );
    }
    seen.add(id);

    if (!isBlockAllowed(allowed, type)) {
      return refuse(
        path,
        type,
        `Block "${type}" is not allowed in this field.`,
      );
    }

    const entry = registry.get(type);
    if (!entry) {
      return refuse(
        path,
        type,
        `Block "${type}" is not registered. Install or enable the plugin that provides it.`,
      );
    }

    const resolution = resolveBlockVariant(entry.definition, variant);
    if (resolution.kind === "unknown") {
      const declared = blockVariants(entry.definition);

      return refuse(
        path,
        type,
        declared.length === 0
          ? `Block "${type}" is stored with the variant "${resolution.variant}" and declares no variants at all. A variant is a layout the block itself has to implement, so it cannot be invented by whoever writes the record.`
          : `Block "${type}" has no variant "${resolution.variant}". It offers ${declared.map(entryVariant => `"${entryVariant.id}"`).join(", ")}.`,
      );
    }

    const parsed = safeParseBlockData(entry.definition, envelope.data.data);
    if (!parsed.success) {
      return refuse(
        path,
        type,
        `Block "${type}" data is invalid - ${blockDataIssues(parsed.error)}.`,
      );
    }

    return {
      data: parsed.data as Record<string, unknown>,
      id,
      type,
      ...(variant === undefined ? {} : { variant }),
    };
  };

  const parseArea = (value: unknown, index: number): void => {
    const envelope = zodAreaEnvelope.safeParse(value);
    if (!envelope.success) {
      refuse(
        [index],
        CONTENT_AREA_KIND,
        `This area is malformed - ${blockDataIssues(envelope.error)}.`,
      );

      return;
    }

    const { children, id, layout } = envelope.data;

    if (seen.has(id)) {
      refuse(
        [index],
        CONTENT_AREA_KIND,
        `Block instance id "${id}" appears more than once. Every instance needs its own stable id.`,
      );

      return;
    }
    seen.add(id);

    const kept: AnyBlockInstance[] = [];

    children.forEach((child, childIndex) => {
      const path: ContentNodePath = [index, "children", childIndex];

      if (isAreaLike(child)) {
        refuse(path, CONTENT_AREA_KIND, NESTED_AREA);

        return;
      }

      const instance = parseBlock(child, path);
      if (instance) kept.push(instance);
    });

    instances.push({ children: kept, id, kind: CONTENT_AREA_KIND, layout });
  };

  envelopes.forEach((value, index) => {
    if (isAreaLike(value)) {
      parseArea(value, index);

      return;
    }

    const instance = parseBlock(value, [index]);
    if (instance) instances.push(instance);
  });

  return { instances, issues };
};

const OUTER_CAP = `A stored zone holds at most ${CONTENT_BLOCKS_ABSOLUTE_MAX} nodes at its top level. That ceiling is what the column can be read back through, not the field's own limit - lower the field's "max" if you want a smaller one.`;

const COUNTED_IN_AREAS =
  "A block inside an area counts towards that limit; the area holding it does not.";

const blockCount = (count: number): string =>
  `${count} ${count === 1 ? "block" : "blocks"}`;

export const zodContentNodes = ({
  allowed,
  max = CONTENT_BLOCKS_DEFAULT_MAX,
  min = 0,
  registry,
}: {
  allowed: BlockAllowedSpec;
  max?: number;
  min?: number;
  registry?: (() => BlockRegistry) | BlockRegistry;
}): z.ZodType<ContentNode[]> =>
  z
    .array(z.unknown())
    .max(CONTENT_BLOCKS_ABSOLUTE_MAX, OUTER_CAP)
    .transform((value, ctx) => {
      const { instances, issues } = parseContentNodes({
        allowed,
        envelopes: value,
        registry: resolveBlockRegistry(
          typeof registry === "function" ? registry() : registry,
        ),
      });

      for (const issue of issues) {
        ctx.addIssue({
          code: "custom",
          message: issue.message,
          path: issue.path,
        });
      }

      const blocks = contentNodeBlocks(instances).length;

      if (blocks < min) {
        ctx.addIssue({
          code: "custom",
          message: `This zone needs at least ${blockCount(min)} and was given ${blockCount(blocks)}. ${COUNTED_IN_AREAS}`,
          path: [],
        });
      }

      if (blocks > max) {
        ctx.addIssue({
          code: "custom",
          message: `This zone accepts at most ${blockCount(max)} and was given ${blockCount(blocks)}. ${COUNTED_IN_AREAS}`,
          path: [],
        });
      }

      return instances;
    });

export const parseBlockInstances = parseContentNodes;

export const zodBlockInstances = zodContentNodes;
