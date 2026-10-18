/** A parsed emoji-or-icon value: one emoji, or a Lucide icon name in kebab case. */
export type EmojiIconValue =
  | { type: "emoji"; value: string }
  | { type: "icon"; value: string };

/** The longest stored value (`emoji:…` / `icon:…`) {@link parseEmojiIcon} accepts. */
export const EMOJI_ICON_MAX_LENGTH = 64;

const LUCIDE_ICON_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

let singleEmoji: RegExp | undefined;

export const isLucideIconName = (value: string): boolean =>
  LUCIDE_ICON_NAME.test(value);

export const isSingleEmoji = (value: string): boolean => {
  singleEmoji ??= /^\p{RGI_Emoji}$/v;

  return singleEmoji.test(value);
};

/**
 * Reads a stored `emoji:🚀` or `icon:newspaper` string. Returns `undefined`
 * for anything else: empty, longer than {@link EMOJI_ICON_MAX_LENGTH}, an
 * unknown scheme, more than one emoji, or an icon name that is not kebab case.
 */
export const parseEmojiIcon = (
  raw: null | string | undefined,
): EmojiIconValue | undefined => {
  const trimmed = raw?.trim();

  if (!trimmed || trimmed.length > EMOJI_ICON_MAX_LENGTH) return undefined;

  const separator = trimmed.indexOf(":");

  if (separator === -1) return undefined;

  const scheme = trimmed.slice(0, separator);
  const value = trimmed.slice(separator + 1);

  if (scheme === "icon") {
    return isLucideIconName(value) ? { type: "icon", value } : undefined;
  }

  if (scheme === "emoji") {
    return isSingleEmoji(value) ? { type: "emoji", value } : undefined;
  }

  return undefined;
};

/** The stored string for a value - `emoji:…` or `icon:…` - or `""` for none. */
export const serializeEmojiIcon = (
  value: EmojiIconValue | null | undefined,
): string => (value ? `${value.type}:${value.value}` : "");

export const iconNameToComponentName = (name: string): string =>
  name
    .split("-")
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

export const componentNameToIconName = (name: string): string =>
  name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/([a-zA-Z])([0-9])/g, "$1-$2")
    .toLowerCase();

export const humanizeIconName = (name: string): string =>
  name
    .split("-")
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
