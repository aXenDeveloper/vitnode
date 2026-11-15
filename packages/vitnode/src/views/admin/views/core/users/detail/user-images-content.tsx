import type {
  UserImageKind,
  UserImageLimit,
} from "@vitnode/api/lib/shared/user-images";

import { useTranslations } from "use-intl";

import type { UserImageDialogLabels } from "@/views/profile/images/user-image-dialog";

import { UserImageDialog } from "@/views/profile/images/user-image-dialog";

export type UploadAdminUserImage = (
  id: number,
  kind: UserImageKind,
  file: File,
) => Promise<void>;

export type RemoveAdminUserImage = (
  id: number,
  kind: UserImageKind,
) => Promise<void>;

const useAdminImageLabels = ({
  hasImage,
  kind,
  limit,
}: {
  hasImage: boolean;
  kind: UserImageKind;
  limit: UserImageLimit;
}): UserImageDialogLabels => {
  const t = useTranslations("admin.user.show.images");
  const tKind = useTranslations(`admin.user.show.images.${kind}`);
  const tGlobal = useTranslations("core.global");

  return {
    cancel: tGlobal("cancel"),
    chooseAction: t("chooseAction"),
    confirmRemove: t("confirmRemove"),
    confirmUpload: t("confirmUpload"),
    desc: hasImage ? tKind("dialogDesc") : tKind("dialogDescEmpty"),
    remove: tKind("remove"),
    removeDesc: tKind("removeDesc"),
    title: tKind("edit"),
    upload: hasImage ? tKind("change") : tKind("upload"),
    ...(limit.allowed ? {} : { uploadDesc: t("notAllowed") }),
  };
};

export const AdminUserImageDialog = ({
  hasImage,
  id,
  kind,
  limit,
  onRemove,
  onUpload,
}: {
  hasImage: boolean;
  id: number;
  kind: UserImageKind;
  limit: UserImageLimit;
  onRemove: RemoveAdminUserImage;
  onUpload: UploadAdminUserImage;
}) => {
  const labels = useAdminImageLabels({ hasImage, kind, limit });

  return (
    <UserImageDialog
      canUpload
      hasImage={hasImage}
      kind={kind}
      labels={labels}
      maxBytes={limit.maxBytes}
      onRemove={async () => {
        await onRemove(id, kind);
      }}
      onUpload={async file => {
        await onUpload(id, kind, file);
      }}
    />
  );
};
