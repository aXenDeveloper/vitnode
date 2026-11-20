import type {
  SearchResultItem,
  SearchTimelineEntry,
  SearchTimelineReactionEntry,
} from "./types";

import { getSearchTypeRenderer } from "./registry";
import { isSearchTimelineReaction } from "./types";

type ReactionContext = NonNullable<
  SearchTimelineReactionEntry["target"]["context"]
>;

export type TimelineReactedKind = "comment" | "other" | "topic";

export interface TimelineReactionGroup {
  context: ReactionContext;
  createdAt: Date | string;
  entries: SearchTimelineReactionEntry[];
  kind: "reaction-group";
  reaction: SearchTimelineReactionEntry["reaction"];
  targetKind: TimelineReactedKind;
}

export type TimelineRow =
  | SearchResultItem
  | SearchTimelineReactionEntry
  | TimelineReactionGroup;

export const TIMELINE_GROUP_VISIBLE_ITEMS = 5;

export const isTimelineReactionGroup = (
  row: TimelineRow,
): row is TimelineReactionGroup =>
  "kind" in row && row.kind === "reaction-group";

const kindOfType = (type: string): TimelineReactedKind => {
  const { labelKey } = getSearchTypeRenderer(type, { thread: true });
  if (labelKey === "types.forum_topic") return "topic";
  if (labelKey === "types.comment" || labelKey === "types.forum_comment") {
    return "comment";
  }

  return "other";
};

const targetKindOf = (
  entries: readonly SearchTimelineReactionEntry[],
): TimelineReactedKind => {
  const kinds = new Set(entries.map(entry => kindOfType(entry.target.type)));
  const [only] = kinds;

  return kinds.size === 1 && only ? only : "other";
};

const groupKeyOf = (
  entry: SearchTimelineReactionEntry,
  context: ReactionContext,
) => `${entry.reaction.code}\u0000${context.url ?? context.title}`;

export const groupTimelineReactions = (
  entries: readonly SearchTimelineEntry[],
): TimelineRow[] => {
  const rows: TimelineRow[] = [];
  const groups = new Map<string, TimelineReactionGroup>();

  for (const entry of entries) {
    if (!isSearchTimelineReaction(entry) || !entry.target.context) {
      rows.push(entry);
      continue;
    }

    const context = entry.target.context;
    const key = groupKeyOf(entry, context);
    const known = groups.get(key);
    if (known) {
      known.entries.push(entry);
      continue;
    }

    const group: TimelineReactionGroup = {
      context,
      createdAt: entry.createdAt,
      entries: [entry],
      kind: "reaction-group",
      reaction: entry.reaction,
      targetKind: "other",
    };
    groups.set(key, group);
    rows.push(group);
  }

  return rows.map(row => {
    if (!isTimelineReactionGroup(row)) return row;
    const [only, second] = row.entries;
    if (only && !second) return only;

    return { ...row, targetKind: targetKindOf(row.entries) };
  });
};
