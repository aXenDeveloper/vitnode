import type { ContentLiveMember } from "@/content/live/protocol";

import { colorLuminance } from "@/lib/colors";

const CONTENT_LIVE_FALLBACK_COLOR = "71717a";

const HEX_COLOR = /^#?([0-9a-f]{6})$/i;

export const contentLiveMemberColor = (avatarColor: null | string): string => {
  const match = HEX_COLOR.exec(avatarColor?.trim() ?? "");

  return `#${(match?.[1] ?? CONTENT_LIVE_FALLBACK_COLOR).toLowerCase()}`;
};

export const contentLiveLabelColor = (background: string): string => {
  const light = colorLuminance(background) ?? 0;
  const onWhite = 1.05 / (light + 0.05);
  const onBlack = (light + 0.05) / 0.05;

  return onBlack >= onWhite ? "#0a0a0a" : "#ffffff";
};

export interface ContentLiveViewer {
  clientId: string;
  self: null | number;
}

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

export const contentLiveOthers = (
  members: readonly ContentLiveMember[],
  viewer: ContentLiveViewer,
): ContentLiveMember[] => perPerson(othersOnly(members, viewer));

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
