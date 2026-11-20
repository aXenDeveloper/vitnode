import type { UserFormat } from "@/components/user-format";

export interface SearchResultAuthor {
  avatarColor: string;
  avatarUrl: null | string;
  id: number;
  name: string;
  nameCode: string;
}

export type SearchTimelineOwner = Pick<SearchResultAuthor, "id"> &
  React.ComponentProps<typeof UserFormat>["user"];

export interface SearchResultItem {
  author: null | SearchResultAuthor;
  authorId: null | number;
  authors: SearchResultAuthor[];
  containerId: null | number;
  containerType: null | string;
  content: string;
  createdAt: Date | string;
  id: number;
  image: null | { height?: number; url: string; width?: number };
  isHidden: boolean;
  isPublic: boolean;
  itemId: number | string;
  itemType: string;
  languageCode: string;
  metadata: Record<string, unknown>;
  pluginId: string;
  score: null | number;
  title: string;
  url: null | string;
}

/** A reaction a member gave, as their profile timeline shows it next to what they wrote. */
export interface SearchTimelineReactionEntry {
  createdAt: Date | string;
  kind: "reaction";
  reaction: {
    code: string;
    icon: null | string;
    image: null | {
      animated: boolean;
      height: null | number;
      posterUrl: null | string;
      url: string;
      width: null | number;
    };
    kind: "emoji" | "icon" | "image";
    title: { languageCode: string; value: string }[];
  };
  target: {
    context?: { title: string; url: null | string };
    id: string;
    /** i18n key naming the kind of thing, called with `count: 1`. */
    label: string;
    pluginId: string;
    title: string;
    type: string;
    url: string;
  };
}

/** One row of a timeline: something written, or a reaction given. */
export type SearchTimelineEntry =
  | SearchResultItem
  | SearchTimelineReactionEntry;

export const isSearchTimelineReaction = (
  entry: SearchTimelineEntry,
): entry is SearchTimelineReactionEntry =>
  "kind" in entry && entry.kind === "reaction";

export interface SearchFeedPage {
  edges: SearchResultItem[];
  pageInfo: {
    count: number;
    endCursor: null | number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: null | number;
    totalCount: number;
  };
}
