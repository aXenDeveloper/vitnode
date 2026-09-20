import type { z } from "zod";

import type { ContentFieldMap } from "../content/types";
import type { AnyBlockDefinition, BlockData, BlockDefinition } from "./types";

import { contentFieldValuesObject } from "../content/schemas";
import { BlockError } from "./errors";

const cache = new WeakMap<AnyBlockDefinition, z.ZodObject<z.ZodRawShape>>();

export const buildBlockDataSchema = (
  fields: ContentFieldMap,
): z.ZodObject<z.ZodRawShape> => contentFieldValuesObject(fields);

export const blockDataSchema = (
  definition: AnyBlockDefinition,
): z.ZodObject<z.ZodRawShape> => {
  const cached = cache.get(definition);
  if (cached) return cached;

  const built = buildBlockDataSchema(definition.fields);
  cache.set(definition, built);

  return built;
};

export const blockDataIssues = (error: z.ZodError): string =>
  error.issues
    .map(issue => {
      const path = issue.path.join(".");

      return path === "" ? issue.message : `${path}: ${issue.message}`;
    })
    .join("; ");

export const safeParseBlockData = (
  definition: AnyBlockDefinition,
  value: unknown,
): z.ZodSafeParseResult<unknown> =>
  blockDataSchema(definition).safeParse(value);

export const parseBlockData = <TFields extends ContentFieldMap>(
  definition: BlockDefinition<string, TFields>,
  value: unknown,
): BlockData<TFields> => {
  const parsed = safeParseBlockData(definition, value);

  if (!parsed.success) {
    throw new BlockError(
      `Block data does not match the block's fields - ${blockDataIssues(parsed.error)}.`,
      { blockId: definition.id },
    );
  }

  return parsed.data as BlockData<TFields>;
};
