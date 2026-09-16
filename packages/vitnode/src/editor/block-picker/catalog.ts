import type {
  BlockAllowedSpec,
  BlockRegistry,
  RegisteredBlock,
} from "../../blocks/types";

import { BLOCK_WILDCARD } from "../../blocks/const";
import { parseBlockId } from "../../blocks/namespace";
import { allowedBlocks } from "../../blocks/registry";

export interface BlockCatalogEntry {
  description: string | undefined;
  name: string;
  namespace: string;
  type: string;
}

export interface BlockCatalogGroup {
  entries: readonly BlockCatalogEntry[];
  namespace: string;
}

export const toBlockCatalogEntry = (
  entry: RegisteredBlock,
): BlockCatalogEntry => ({
  description: entry.definition.description,
  name: entry.definition.name ?? entry.definition.id,
  namespace: parseBlockId(entry.type)?.namespace ?? entry.namespace,
  type: entry.type,
});

export const blockCatalogFor = (
  registry: BlockRegistry,
  allowed: BlockAllowedSpec | undefined,
): BlockCatalogEntry[] =>
  allowedBlocks(registry, allowed ?? BLOCK_WILDCARD).map(toBlockCatalogEntry);

export const matchesBlockQuery = (
  entry: BlockCatalogEntry,
  query: string,
): boolean => {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;

  return [entry.description, entry.name, entry.namespace, entry.type].some(
    field => field?.toLocaleLowerCase().includes(needle),
  );
};

export const groupBlockCatalog = ({
  entries,
  query = "",
}: {
  entries: readonly BlockCatalogEntry[];
  query?: string;
}): BlockCatalogGroup[] => {
  const groups = new Map<string, BlockCatalogEntry[]>();

  for (const entry of entries) {
    if (!matchesBlockQuery(entry, query)) continue;

    const siblings = groups.get(entry.namespace);
    if (siblings) siblings.push(entry);
    else groups.set(entry.namespace, [entry]);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([namespace, group]) => ({
      entries: group.sort((left, right) => left.name.localeCompare(right.name)),
      namespace,
    }));
};
