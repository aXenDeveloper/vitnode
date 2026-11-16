export const USER_IMAGE_KINDS = ["avatar", "cover"] as const;

export type UserImageKind = (typeof USER_IMAGE_KINDS)[number];

export const USER_IMAGE_FOLDERS: Record<UserImageKind, string> = {
  avatar: "avatars",
  cover: "covers",
};

export const USER_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export interface UserImageLimit {
  allowed: boolean;
  maxBytes: number;
}

export type UserImagePolicy = Record<UserImageKind, UserImageLimit>;

export interface UserImageUrls {
  avatarUrl: null | string;
  coverUrl: null | string;
}

export type UserImageShape = "circle" | "rect";

export const USER_IMAGE_OUTPUT: Record<
  UserImageKind,
  { aspect: number; height: number; shape: UserImageShape; width: number }
> = {
  avatar: { aspect: 1, height: 512, shape: "circle", width: 512 },
  cover: { aspect: 3, height: 600, shape: "rect", width: 1800 },
};
