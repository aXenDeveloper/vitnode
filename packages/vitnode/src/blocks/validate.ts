import { z } from "zod";

import type {
  AnyBlockInstance,
  BlockAllowedSpec,
  BlockRegistry,
} from "./types";

import {
  BLOCK_INSTANCE_ID_MAX_LENGTH,
  BLOCK_INSTANCE_ID_PATTERN,
  CONTENT_BLOCKS_DEFAULT_MAX,
} from "./const";
import { isBlockAllowed, resolveBlockRegistry } from "./registry";
import { blockDataIssues, safeParseBlockData } from "./schema";

export interface BlockInstanceIssue {
  index: number;
  message: string;
  type: string;
}

export interface BlockInstancesResult {
  instances: AnyBlockInstance[];
  issues: BlockInstanceIssue[];
}

const zodBlockEnvelope = z.strictObject({
  data: z.record(z.string(), z.unknown()),
  id: z
    .string()
    .max(BLOCK_INSTANCE_ID_MAX_LENGTH)
    .regex(
      BLOCK_INSTANCE_ID_PATTERN,
      "A block instance id is 1-64 characters of letters, digits, hyphens or underscores.",
    ),
  type: z.string(),
});

export type BlockEnvelope = z.infer<typeof zodBlockEnvelope>;

export const parseBlockInstances = ({
  allowed,
  envelopes,
  registry,
}: {
  allowed: BlockAllowedSpec;
  envelopes: readonly BlockEnvelope[];
  registry: BlockRegistry;
}): BlockInstancesResult => {
  const instances: AnyBlockInstance[] = [];
  const issues: BlockInstanceIssue[] = [];
  const seen = new Set<string>();

  envelopes.forEach((envelope, index) => {
    const { id, type } = envelope;

    if (seen.has(id)) {
      issues.push({
        index,
        message: `Block instance id "${id}" appears more than once. Every instance needs its own stable id.`,
        type,
      });

      return;
    }
    seen.add(id);

    if (!isBlockAllowed(allowed, type)) {
      issues.push({
        index,
        message: `Block "${type}" is not allowed in this field.`,
        type,
      });

      return;
    }

    const entry = registry.get(type);
    if (!entry) {
      issues.push({
        index,
        message: `Block "${type}" is not registered. Install or enable the plugin that provides it.`,
        type,
      });

      return;
    }

    const parsed = safeParseBlockData(entry.definition, envelope.data);
    if (!parsed.success) {
      issues.push({
        index,
        message: `Block "${type}" data is invalid - ${blockDataIssues(parsed.error)}.`,
        type,
      });

      return;
    }

    instances.push({
      data: parsed.data as Record<string, unknown>,
      id,
      type,
    });
  });

  return { instances, issues };
};

export const zodBlockInstances = ({
  allowed,
  max = CONTENT_BLOCKS_DEFAULT_MAX,
  min = 0,
  registry,
}: {
  allowed: BlockAllowedSpec;
  max?: number;
  min?: number;
  registry?: (() => BlockRegistry) | BlockRegistry;
}): z.ZodType<AnyBlockInstance[]> =>
  z
    .array(zodBlockEnvelope)
    .min(min)
    .max(max)
    .transform((value, ctx) => {
      const { instances, issues } = parseBlockInstances({
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
          path: [issue.index],
        });
      }

      return instances;
    });
