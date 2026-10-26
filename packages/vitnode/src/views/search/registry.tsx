import {
  FileTextIcon,
  type LucideIcon,
  MessageSquareIcon,
  MessagesSquareIcon,
} from "lucide-react";

export type SearchTypeLabelKey =
  | "types.blog_post"
  | "types.comment"
  | "types.forum_comment"
  | "types.forum_topic"
  | "types.unknown";

export type SearchActivityKey = "activity.commented" | "activity.posted_in";

export interface SearchTypeRenderer {
  activityKey?: SearchActivityKey;
  icon: LucideIcon;
  labelKey: SearchTypeLabelKey;
}

// Add an entry here to give a content type its own icon and label in the feed.
// A type without an entry falls back to the generic renderer, so a plugin that
// indexes a new type never breaks the feed.
const renderers: Record<string, SearchTypeRenderer> = {
  "blog.post": { icon: FileTextIcon, labelKey: "types.blog_post" },
  "forum.comment": {
    activityKey: "activity.commented",
    icon: MessageSquareIcon,
    labelKey: "types.forum_comment",
  },
  "forum.topic": {
    activityKey: "activity.posted_in",
    icon: MessagesSquareIcon,
    labelKey: "types.forum_topic",
  },
};

const fallback: SearchTypeRenderer = {
  icon: FileTextIcon,
  labelKey: "types.unknown",
};

const threadReply: SearchTypeRenderer = {
  activityKey: "activity.commented",
  icon: MessageSquareIcon,
  labelKey: "types.comment",
};

export const getSearchTypeRenderer = (
  itemType: string,
  metadata?: Record<string, unknown>,
): SearchTypeRenderer =>
  renderers[itemType] ?? (metadata?.thread === true ? threadReply : fallback);

export const searchTypeKeys = Object.keys(renderers);
