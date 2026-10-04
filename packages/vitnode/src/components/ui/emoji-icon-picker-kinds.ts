/** Both kinds, unless a caller narrows it - see the `allow` prop. */
export const EMOJI_ICON_PICKER_KINDS = ["emoji", "icon"] as const;

export type EmojiIconPickerKind = (typeof EMOJI_ICON_PICKER_KINDS)[number];
