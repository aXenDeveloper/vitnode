import type { Context } from "hono";

import { and, asc, eq, inArray } from "drizzle-orm";

import type {
  NavigationKind,
  NavigationPreset,
  NavigationText,
  PublicNavigationItem,
  PublicNavigationNode,
} from "@/lib/navigation";

import { findNavigationPreset } from "@/api/lib/navigation-presets";
import { CONFIG_PLUGIN } from "@/config";
import { core_languages_words } from "@/database/languages";
import { core_navigation } from "@/database/navigation";
import {
  NAVIGATION_KINDS,
  NAVIGATION_TABLE_NAME,
  NAVIGATION_WORDS,
} from "@/lib/navigation";

export interface NavigationRecord {
  createdAt: Date;
  description: NavigationText[];
  href: null | string;
  icon: null | string;
  id: number;
  isOpenInNewTab: boolean;
  kind: NavigationKind;
  parentId: null | number;
  pluginId: null | string;
  position: number;
  presetId: null | string;
  title: NavigationText[];
  updatedAt: Date;
}

export interface AdminNavigationRecord extends NavigationRecord {
  preset: NavigationPreset | null;
}

interface NavigationWord {
  itemId: number;
  languageCode: string;
  value: string;
  variable: string;
}

const isNavigationKind = (value: string): value is NavigationKind =>
  (NAVIGATION_KINDS as readonly string[]).includes(value);

export const groupNavigationWords = (
  words: readonly NavigationWord[],
): Map<number, { description: NavigationText[]; title: NavigationText[] }> => {
  const byItem = new Map<
    number,
    { description: NavigationText[]; title: NavigationText[] }
  >();

  for (const word of words) {
    const entry = byItem.get(word.itemId) ?? { description: [], title: [] };
    const text = { languageCode: word.languageCode, value: word.value };

    if (word.variable === NAVIGATION_WORDS.title) entry.title.push(text);
    if (word.variable === NAVIGATION_WORDS.description) {
      entry.description.push(text);
    }

    byItem.set(word.itemId, entry);
  }

  return byItem;
};

export const readNavigationWords = async (
  c: Context,
  itemIds: readonly number[],
): Promise<NavigationWord[]> => {
  if (itemIds.length === 0) return [];

  return await c
    .get("db")
    .select({
      itemId: core_languages_words.itemId,
      languageCode: core_languages_words.languageCode,
      value: core_languages_words.value,
      variable: core_languages_words.variable,
    })
    .from(core_languages_words)
    .where(
      and(
        eq(core_languages_words.pluginCode, CONFIG_PLUGIN.pluginId),
        eq(core_languages_words.tableName, NAVIGATION_TABLE_NAME),
        inArray(core_languages_words.variable, [
          NAVIGATION_WORDS.title,
          NAVIGATION_WORDS.description,
        ]),
        inArray(core_languages_words.itemId, [...itemIds]),
      ),
    );
};

export const readNavigationRecords = async (
  c: Context,
): Promise<NavigationRecord[]> => {
  const rows = await c
    .get("db")
    .select()
    .from(core_navigation)
    .orderBy(asc(core_navigation.position), asc(core_navigation.id));

  const words = groupNavigationWords(
    await readNavigationWords(
      c,
      rows.map(row => row.id),
    ),
  );

  return rows.map(row => ({
    createdAt: row.createdAt,
    description: words.get(row.id)?.description ?? [],
    href: row.href,
    icon: row.icon,
    id: row.id,
    isOpenInNewTab: row.isOpenInNewTab,
    kind: isNavigationKind(row.kind) ? row.kind : "custom",
    parentId: row.parentId,
    pluginId: row.pluginId,
    position: row.position,
    presetId: row.presetId,
    title: words.get(row.id)?.title ?? [],
    updatedAt: row.updatedAt,
  }));
};

const presetOf = (
  record: Pick<NavigationRecord, "kind" | "pluginId" | "presetId">,
  presets: readonly NavigationPreset[],
): NavigationPreset | null =>
  record.kind === "preset" && record.pluginId && record.presetId
    ? (findNavigationPreset(presets, record.pluginId, record.presetId) ?? null)
    : null;

export const withNavigationPresets = (
  records: readonly NavigationRecord[],
  presets: readonly NavigationPreset[],
): AdminNavigationRecord[] =>
  records.map(record => ({ ...record, preset: presetOf(record, presets) }));

export interface NavigationTree<
  T extends { id: number; parentId: null | number },
> {
  childrenOf: Map<number, T[]>;
  roots: T[];
}

export const navigationTreeOf = <
  T extends { id: number; parentId: null | number },
>(
  records: readonly T[],
): NavigationTree<T> => {
  const byId = new Map(records.map(record => [record.id, record]));
  const parentOf = (record: T): null | number => {
    if (record.parentId === null) return null;

    const parent = byId.get(record.parentId);

    return parent?.parentId === null ? parent.id : null;
  };

  const roots: T[] = [];
  const childrenOf = new Map<number, T[]>();

  for (const record of records) {
    const parentId = parentOf(record);
    if (parentId === null) {
      roots.push(record);
      continue;
    }

    childrenOf.set(parentId, [...(childrenOf.get(parentId) ?? []), record]);
  }

  return { childrenOf, roots };
};

const publicItemOf = (
  record: NavigationRecord,
  presets: readonly NavigationPreset[],
): null | PublicNavigationItem => {
  const preset = presetOf(record, presets);
  const href = record.kind === "preset" ? preset?.href : record.href;
  if (!href) return null;

  return {
    description: record.description,
    href,
    icon: record.icon ?? preset?.icon ?? null,
    id: record.id,
    isOpenInNewTab: record.isOpenInNewTab,
    kind: record.kind,
    pluginId: record.pluginId,
    presetId: record.presetId,
    title: record.title,
  };
};

export const toPublicNavigation = (
  records: readonly NavigationRecord[],
  presets: readonly NavigationPreset[],
): PublicNavigationNode[] => {
  const { childrenOf, roots } = navigationTreeOf(records);

  return roots.flatMap(root => {
    const items = (childrenOf.get(root.id) ?? []).flatMap(child => {
      const item = publicItemOf(child, presets);

      return item ? [item] : [];
    });
    const item = publicItemOf(root, presets);

    if (!item) return items.map(orphan => ({ ...orphan, items: [] }));

    return [{ ...item, items }];
  });
};
