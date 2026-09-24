import type {
  BlockAllowedSpec,
  BlockIcon,
  BlockRegistry,
  RegisteredBlock,
} from "../../blocks/types";

import { BLOCK_WILDCARD } from "../../blocks/const";
import { parseBlockId } from "../../blocks/namespace";
import { allowedBlocks } from "../../blocks/registry";

export interface BlockCatalogEntry {
  description: string | undefined;
  icon: BlockIcon | undefined;
  name: string;
  namespace: string;
  type: string;
}

export interface AreaCatalogEntry {
  description: string;
  name: string;
}

export interface BlockCatalogLayoutSection {
  area: AreaCatalogEntry;
  label: string;
}

export type BlockCatalogGroup =
  | {
      area: AreaCatalogEntry;
      id: "layout";
      kind: "layout";
      label: string;
    }
  | {
      entries: readonly BlockCatalogEntry[];
      id: string;
      kind: "namespace";
      label: string;
    };

export interface BlockCatalogSource {
  allowedBlocks: BlockAllowedSpec | undefined;
  registry: BlockRegistry | undefined;
}

export interface MergedBlockCatalog {
  entries: BlockCatalogEntry[];
  installed: number;
}

export type BlockCatalogNotice =
  "empty" | "no_results" | "none_installed" | null;

export const LAYOUT_CATALOG_GROUP_ID = "layout";

export const toBlockCatalogEntry = (
  entry: RegisteredBlock,
): BlockCatalogEntry => ({
  description: entry.definition.description,
  icon: entry.definition.icon,
  name: entry.definition.name ?? entry.definition.id,
  namespace: parseBlockId(entry.type)?.namespace ?? entry.namespace,
  type: entry.type,
});

export const blockCatalogFor = (
  registry: BlockRegistry,
  allowed: BlockAllowedSpec | undefined,
): BlockCatalogEntry[] =>
  allowedBlocks(registry, allowed ?? BLOCK_WILDCARD).map(toBlockCatalogEntry);

export const mergeBlockCatalogs = ({
  fallback,
  sources,
}: {
  fallback?: BlockRegistry | undefined;
  sources: readonly BlockCatalogSource[];
}): MergedBlockCatalog => {
  const entries = new Map<string, BlockCatalogEntry>();
  const installed = new Set<string>();

  for (const source of sources) {
    const registry = source.registry ?? fallback;
    if (!registry) continue;

    for (const block of registry.all()) installed.add(block.type);

    for (const entry of blockCatalogFor(registry, source.allowedBlocks)) {
      if (!entries.has(entry.type)) entries.set(entry.type, entry);
    }
  }

  return {
    entries: [...entries.values()].sort((left, right) =>
      left.type.localeCompare(right.type),
    ),
    installed: installed.size,
  };
};

const normalizeQuery = (query: string): string =>
  query.trim().toLocaleLowerCase();

export const matchesBlockQuery = (
  entry: BlockCatalogEntry,
  query: string,
): boolean => {
  const needle = normalizeQuery(query);
  if (!needle) return true;

  return [entry.description, entry.name, entry.namespace, entry.type].some(
    field => field?.toLocaleLowerCase().includes(needle),
  );
};

export const matchesLayoutQuery = (
  layout: BlockCatalogLayoutSection,
  query: string,
): boolean => {
  const needle = normalizeQuery(query);
  if (!needle) return true;

  return [layout.area.description, layout.area.name, layout.label].some(field =>
    field.toLocaleLowerCase().includes(needle),
  );
};

export const groupBlockCatalog = ({
  entries,
  layout,
  query = "",
}: {
  entries: readonly BlockCatalogEntry[];
  layout?: BlockCatalogLayoutSection | undefined;
  query?: string;
}): BlockCatalogGroup[] => {
  const groups = new Map<string, BlockCatalogEntry[]>();

  for (const entry of entries) {
    if (!matchesBlockQuery(entry, query)) continue;

    const siblings = groups.get(entry.namespace);
    if (siblings) siblings.push(entry);
    else groups.set(entry.namespace, [entry]);
  }

  const namespaces: BlockCatalogGroup[] = [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([namespace, group]) => ({
      entries: group.sort((left, right) => left.name.localeCompare(right.name)),
      id: namespace,
      kind: "namespace",
      label: namespace,
    }));

  if (!layout || !matchesLayoutQuery(layout, query)) return namespaces;

  return [
    {
      area: layout.area,
      id: LAYOUT_CATALOG_GROUP_ID,
      kind: "layout",
      label: layout.label,
    },
    ...namespaces,
  ];
};

export const blockCatalogNotice = ({
  installed,
  matched,
  offered,
}: {
  installed: number;
  matched: number;
  offered: number;
}): BlockCatalogNotice => {
  if (installed === 0) return "none_installed";
  if (offered === 0) return "empty";
  if (matched === 0) return "no_results";

  return null;
};
