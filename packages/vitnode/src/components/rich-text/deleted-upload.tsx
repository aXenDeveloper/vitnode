import { FileXIcon, ImageOffIcon } from "lucide-react";
import { useTranslations } from "use-intl";

/** Whether a rich-text node is an image or attachment whose file was deleted. */
export const isDeletedUploadNode = ({
  attrs,
  type,
}: {
  attrs?: Record<string, unknown>;
  type: string;
}): boolean =>
  (type === "image" || type === "attachment") && attrs?.deleted === true;

/**
 * The placeholder shown instead of an image or attachment whose file was
 * deleted from `core_files`: the name or ALT text it had, and a note that it
 * is gone. Nothing in it links to the removed file.
 */
export const DeletedUpload = ({
  attrs,
  type,
}: {
  attrs?: Record<string, unknown>;
  type: string;
}) => {
  const t = useTranslations("core.global.editor.uploads");
  const isImage = type === "image";
  const label = isImage ? attrs?.alt : attrs?.name;

  return (
    <span className="tiptap-upload-deleted" data-drag-image="" role="note">
      <span aria-hidden="true" className="tiptap-upload-deleted-icon">
        {isImage ? <ImageOffIcon /> : <FileXIcon />}
      </span>
      <span className="flex min-w-0 flex-col">
        {typeof label === "string" && label !== "" && (
          <span className="tiptap-attachment-name">{label}</span>
        )}
        <span className="tiptap-attachment-meta">
          {isImage ? t("deleted_image") : t("deleted_file")}
        </span>
      </span>
    </span>
  );
};
