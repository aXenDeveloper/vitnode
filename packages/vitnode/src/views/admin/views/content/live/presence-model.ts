import type { ContentLiveMember } from "@/content/live/protocol";

/** The avatar color of a member without one: a neutral zinc. */
export const CONTENT_LIVE_FALLBACK_COLOR = "71717a";

const HEX_COLOR = /^#?([0-9a-f]{6})$/i;

/** A member's avatar color as `#rrggbb`, the only form carets accept. */
export const contentLiveMemberColor = (avatarColor: null | string): string => {
  const match = HEX_COLOR.exec(avatarColor?.trim() ?? "");

  return `#${(match?.[1] ?? CONTENT_LIVE_FALLBACK_COLOR).toLowerCase()}`;
};

const channel = (value: number): number => {
  const srgb = value / 255;

  return srgb <= 0.039_28 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex: string): number => {
  const value = Number.parseInt(hex.slice(1), 16);

  return (
    0.2126 * channel((value >> 16) & 255) +
    0.7152 * channel((value >> 8) & 255) +
    0.0722 * channel(value & 255)
  );
};

/**
 * Black or white, whichever reads better on `background` (`#rrggbb`) - the
 * text of a caret label sits on the member's own color.
 */
export const contentLiveLabelColor = (background: string): string => {
  const light = luminance(background);
  const onWhite = 1.05 / (light + 0.05);
  const onBlack = (light + 0.05) / 0.05;

  return onBlack >= onWhite ? "#0a0a0a" : "#ffffff";
};

export interface ContentLiveViewer {
  /** This tab. */
  clientId: string;
  /** This person, once known. */
  self: null | number;
}

/** Everyone but this person - in any of their tabs. */
const othersOnly = (
  members: readonly ContentLiveMember[],
  { clientId, self }: ContentLiveViewer,
): ContentLiveMember[] => {
  const me =
    members.find(member => member.clientId === clientId)?.userId ?? self;

  return members.filter(
    member => member.clientId !== clientId && member.userId !== me,
  );
};

/**
 * One entry per person: a second tab of the same editor is not a second
 * editor. The tab with a field in focus speaks for the person.
 */
const perPerson = (members: readonly ContentLiveMember[]) => {
  const people = new Map<number, ContentLiveMember>();
  for (const member of members) {
    const known = people.get(member.userId);
    if (!known || (known.field === null && member.field !== null)) {
      people.set(member.userId, member);
    }
  }

  return [...people.values()];
};

/** Everyone else in the record's room, once each. */
export const contentLiveOthers = (
  members: readonly ContentLiveMember[],
  viewer: ContentLiveViewer,
): ContentLiveMember[] => perPerson(othersOnly(members, viewer));

/**
 * The other people in one field. A localized field counts only the language
 * shown (`locale`); a shared field (`null`) is the same in every language.
 */
export const contentLiveFieldEditors = (
  members: readonly ContentLiveMember[],
  viewer: ContentLiveViewer,
  { field, locale }: { field: string; locale: null | string },
): ContentLiveMember[] =>
  perPerson(
    othersOnly(members, viewer).filter(
      member =>
        member.field === field && (locale === null || member.locale === locale),
    ),
  );

/**
 * The other people working in one language - in any field, or in `field`
 * only when it is given.
 */
export const contentLiveLanguageEditors = (
  members: readonly ContentLiveMember[],
  viewer: ContentLiveViewer,
  { field, locale }: { field?: string; locale: string },
): ContentLiveMember[] =>
  perPerson(
    othersOnly(members, viewer).filter(
      member =>
        member.locale === locale &&
        (field === undefined || member.field === field),
    ),
  );
