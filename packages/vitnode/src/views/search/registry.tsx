import { FileTextIcon, type LucideIcon } from "lucide-react";

export type SearchTypeLabelKey = "types.blog_post" | "types.unknown";

export interface SearchTypeRenderer {
  icon: LucideIcon;
  labelKey: SearchTypeLabelKey;
}

// Add an entry here to give a content type its own icon and label in the feed.
// A type without an entry falls back to the generic renderer, so a plugin that
// indexes a new type never breaks the feed.
const renderers: Record<string, SearchTypeRenderer> = {
  blog_post: { icon: FileTextIcon, labelKey: "types.blog_post" },
};

const fallback: SearchTypeRenderer = {
  icon: FileTextIcon,
  labelKey: "types.unknown",
};

export const getSearchTypeRenderer = (itemType: string): SearchTypeRenderer =>
  renderers[itemType] ?? fallback;

export const searchTypeKeys = Object.keys(renderers);
