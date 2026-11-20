/** How a reaction looks: an emoji, a Lucide icon or an uploaded image. Browser-safe. */
export const REACTION_KINDS = ["emoji", "icon", "image"] as const;

export type ReactionKind = (typeof REACTION_KINDS)[number];

/** Limits shared by the API and the UI. Browser-safe. */
export const REACTIONS_LIMITS = {
  /** Targets one `GET /reactions` reads. */
  idsPerRequest: 100,
  /** Highest `maxReactionsPerItem` a role can set (besides unlimited). */
  maxPerItem: 50,
  /** Highest daily limit a role can set (besides unlimited). */
  maxDailyLimit: 100_000,
  /** Reputation points one reaction is worth, either way. */
  maxPoints: 100,
  /** Reactions in the catalog. */
  maxReactions: 50,
  /** Uploaded image size, in bytes. */
  imageMaxBytes: 512 * 1024,
  /** Uploaded images are scaled down to fit this square, in pixels. */
  imageMaxSide: 256,
  /** Writes (add or remove) one member sends per minute. */
  writesPerMinute: 60,
  /** People one `GET /reactions/users` page lists. */
  usersPerPage: 50,
  titleMaxLength: 50,
} as const;

/** Image types an admin can upload as a reaction. No SVG: it can carry script. */
export const REACTION_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

/** Where reaction titles live in `core_languages_words`. */
export const REACTION_WORDS = {
  pluginCode: "core",
  tableName: "core_reactions",
} as const;

/** Lowercase letters, digits and dashes, like `party-parrot`. */
export const REACTION_CODE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The reactions a new installation starts with. */
export const REACTIONS_DEFAULT = [
  { code: "like", icon: "emoji:👍", points: 1, title: "Like" },
  { code: "love", icon: "emoji:❤️", points: 1, title: "Love" },
  { code: "haha", icon: "emoji:😂", points: 1, title: "Haha" },
  { code: "wow", icon: "emoji:😮", points: 1, title: "Wow" },
  { code: "sad", icon: "emoji:😢", points: 0, title: "Sad" },
  { code: "thanks", icon: "icon:hand-heart", points: 2, title: "Thanks" },
  { code: "disagree", icon: "icon:thumbs-down", points: -1, title: "Disagree" },
] as const;
