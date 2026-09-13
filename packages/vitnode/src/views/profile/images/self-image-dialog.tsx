import { useTranslations } from "use-intl";

import type { UserImageEditor, UserImageKind } from "./types";

import { UserImageDialog } from "./user-image-dialog";

export const SelfUserImageDialog = ({
  editor,
  hasImage,
  kind,
  size,
}: {
  editor: UserImageEditor;
  hasImage: boolean;
  kind: UserImageKind;
  size?: "icon" | "icon-sm";
}) => {
  const t = useTranslations("core.profile.images");
  const tKind = useTranslations(`core.profile.images.${kind}`);
  const tGlobal = useTranslations("core.global");
  const limit = editor.policy[kind];

  return (
    <UserImageDialog
      canUpload={limit.allowed}
      hasImage={hasImage}
      kind={kind}
      labels={{
        cancel: tGlobal("cancel"),
        chooseAction: t("chooseAction"),
        confirmRemove: t("confirmRemove"),
        confirmUpload: t("confirmUpload"),
        desc: hasImage ? tKind("dialogDesc") : tKind("dialogDescEmpty"),
        remove: tKind("remove"),
        removeDesc: tKind("removeDesc"),
        title: tKind("edit"),
        upload: hasImage ? tKind("change") : tKind("upload"),
        ...(limit.allowed ? {} : { uploadDesc: tKind("notAllowed") }),
      }}
      maxBytes={limit.maxBytes}
      onRemove={async () => {
        await editor.onRemove(kind);
      }}
      onUpload={async file => {
        await editor.onUpload(kind, file);
      }}
      size={size}
    />
  );
};
