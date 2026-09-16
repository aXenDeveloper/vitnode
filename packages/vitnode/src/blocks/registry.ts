import type {
  BlockAllowedSpec,
  BlockPluginSource,
  BlockRegistry,
  RegisteredBlock,
} from "./types";

import { BLOCK_WILDCARD } from "./const";
import { BlockError, BlockRegistryMissingError } from "./errors";
import {
  assertBlockName,
  assertBlockNamespace,
  blockNamespaceForPlugin,
  parseBlockId,
  qualifiedBlockId,
} from "./namespace";

const describe = (entry: RegisteredBlock): string =>
  `${entry.pluginId} -> ${entry.type}`;

export const buildBlockRegistry = (
  sources: readonly BlockPluginSource[],
): BlockRegistry => {
  const byType = new Map<string, RegisteredBlock>();
  const byNamespace = new Map<string, RegisteredBlock[]>();
  const namespaceOwner = new Map<string, string>();

  for (const source of sources) {
    const namespace = assertBlockNamespace(
      source.namespace ?? blockNamespaceForPlugin(source.pluginId),
      source.pluginId,
    );

    const owner = namespaceOwner.get(namespace);
    if (owner !== undefined && owner !== source.pluginId) {
      throw new BlockError(
        `Block namespace "${namespace}" is claimed by both "${owner}" and "${source.pluginId}". A namespace is derived from the last segment of the plugin id, so two packages ending in the same segment collide - set \`namespace\` on one of their blocks modules.`,
      );
    }
    namespaceOwner.set(namespace, source.pluginId);

    for (const definition of source.blocks ?? []) {
      const type = qualifiedBlockId(namespace, assertBlockName(definition.id));

      const duplicate = byType.get(type);
      if (duplicate) {
        throw new BlockError(
          `Duplicate block id, registered by both ${describe(duplicate)} and ${describe({ definition, namespace, pluginId: source.pluginId, type })}.`,
          { blockId: type },
        );
      }

      const entry: RegisteredBlock = {
        definition,
        namespace,
        pluginId: source.pluginId,
        type,
      };

      byType.set(type, entry);
      const siblings = byNamespace.get(namespace);
      if (siblings) siblings.push(entry);
      else byNamespace.set(namespace, [entry]);
    }
  }

  const all = [...byType.values()].sort((a, b) => a.type.localeCompare(b.type));
  const namespaces = [...byNamespace.keys()].sort((a, b) => a.localeCompare(b));

  return {
    all: () => all,
    byNamespace: namespace => byNamespace.get(namespace) ?? [],
    get: type => byType.get(type),
    has: type => byType.has(type),
    namespaces: () => namespaces,
  };
};

export const isBlockAllowed = (
  allowed: BlockAllowedSpec,
  type: string,
): boolean => {
  const parsed = parseBlockId(type);
  if (!parsed || parsed.name === BLOCK_WILDCARD) return false;

  if (allowed === BLOCK_WILDCARD) return true;

  return allowed.some(entry => {
    if (entry === BLOCK_WILDCARD) return true;
    if (entry === type) return true;

    const pattern = parseBlockId(entry);

    return (
      pattern !== null &&
      pattern.name === BLOCK_WILDCARD &&
      pattern.namespace === parsed.namespace
    );
  });
};

export const allowedBlocks = (
  registry: BlockRegistry,
  allowed: BlockAllowedSpec,
): readonly RegisteredBlock[] =>
  registry.all().filter(entry => isBlockAllowed(allowed, entry.type));

let registered: BlockRegistry | undefined;

export const setBlockRegistry = (registry: BlockRegistry): void => {
  registered = registry;
};

export const blockRegistry = (): BlockRegistry => {
  if (!registered) throw new BlockRegistryMissingError();

  return registered;
};

export const hasBlockRegistry = (): boolean => registered !== undefined;
