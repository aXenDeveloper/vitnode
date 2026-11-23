import type { Context } from "hono";

import type { OgImageTemplateProps } from "@/lib/og-image";

import {
  OG_IMAGE_HEIGHT,
  OG_IMAGE_TYPE,
  OG_IMAGE_WIDTH,
  ogImageApiUrl,
  ogImageBaseProps,
  ogImageVersion,
} from "@/lib/og-image";
import { publicFullNameOf } from "@/lib/user-personal-information";

/** The public fields of a member a profile card is drawn from. */
export interface ProfileCardUser {
  avatarColor: string;
  firstName: null | string;
  headline: null | string;
  lastName: null | string;
  name: string;
  nameCode: string;
  showRealName: boolean;
}

/** A profile's social card, as the profile route returns it. */
export interface ProfileOgImage {
  alt: string;
  height: number;
  type: string;
  url: string;
  width: number;
}

/** What the profile card shows: only what the public profile shows. */
export const profileCardProps = (
  c: Context,
  user: ProfileCardUser,
): OgImageTemplateProps => {
  const fields = c.get("core").personalInformationFields;
  const title = publicFullNameOf(user, fields) ?? user.name;
  const headline = fields.headline ? (user.headline?.trim() ?? "") : "";

  return {
    ...ogImageBaseProps(c),
    avatar: {
      color: `#${user.avatarColor}`,
      initial: Array.from(title.trim())[0]?.toUpperCase() ?? "?",
    },
    description: headline === "" ? null : headline,
    kind: "profile",
    locale: null,
    title,
  };
};

/** The URL version of a profile card: changes when the name, headline or colour does. */
export const profileCardVersion = (
  c: Context,
  props: OgImageTemplateProps,
): string =>
  ogImageVersion(c, [
    "profile",
    props.title,
    props.description,
    props.avatar?.color,
  ]);

/** The profile's card URL, or `null` when cards are off. */
export const profileOgImage = (
  c: Context,
  user: ProfileCardUser,
): null | ProfileOgImage => {
  if (!c.get("core").ogImage.enabled) return null;

  const props = profileCardProps(c, user);

  return {
    alt: props.title,
    height: OG_IMAGE_HEIGHT,
    type: OG_IMAGE_TYPE,
    url: ogImageApiUrl(
      `/@vitnode/core/og/users/${encodeURIComponent(user.nameCode)}`,
      { v: profileCardVersion(c, props) },
    ),
    width: OG_IMAGE_WIDTH,
  };
};
