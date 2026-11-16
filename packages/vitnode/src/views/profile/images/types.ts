import type {
  UserImageKind,
  UserImageLimit,
  UserImagePolicy,
} from "@vitnode/api/lib/shared/user-images";

export type { UserImageKind, UserImageLimit, UserImagePolicy };

export interface UserImageActions {
  onRemove: (kind: UserImageKind) => Promise<void>;
  onUpload: (kind: UserImageKind, file: File) => Promise<void>;
}

export interface UserImageEditor extends UserImageActions {
  policy: UserImagePolicy;
}
