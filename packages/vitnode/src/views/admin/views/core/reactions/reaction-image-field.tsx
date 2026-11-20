import {
  REACTION_IMAGE_MIME_TYPES,
  REACTIONS_LIMITS,
} from "@vitnode/api/lib/reactions/const";
import React from "react";
import { useTranslations } from "use-intl";

import type { ItemAutoFormComponentProps } from "@/components/form/auto-form";
import type { AutoFormFileValue } from "@/components/form/fields/file";

import { AutoFormFile } from "@/components/form/fields/file";

import { uploadAdminReactionImage } from "./reactions-mutations";

/** The image part of a reaction form: ids to save and how to show it. */
export interface ReactionImageValue {
  fileId: number;
  image: {
    animated: boolean;
    height: null | number;
    posterUrl: null | string;
    url: string;
    width: null | number;
  };
  posterFileId: null | number;
}

const toFileValue = (
  value: ReactionImageValue,
  name: string,
  file?: File,
): AutoFormFileValue => ({
  height: value.image.height ?? undefined,
  id: value.fileId,
  mimeType: file?.type ?? "image/*",
  name: file?.name ?? name,
  size: file?.size ?? 0,
  url: value.image.url,
  width: value.image.width ?? undefined,
});

/**
 * An `AutoForm` field for a reaction image, on `AutoFormFile`: the image is
 * uploaded as soon as it is picked or dropped, and the field keeps its file
 * ids together with how to show it.
 */
export const ReactionImageField = (props: ItemAutoFormComponentProps) => {
  const { field } = props;
  const t = useTranslations("admin.reactions.form");
  const value = (field.value ?? null) as null | ReactionImageValue;
  const uploads = React.useRef(new Map<number, ReactionImageValue>());

  return (
    <AutoFormFile
      {...props}
      allowedMimeTypes={REACTION_IMAGE_MIME_TYPES}
      description={value?.image.animated ? t("image_animated_note") : undefined}
      field={{
        ...field,
        onChange: (id: unknown) => {
          if (typeof id !== "number") {
            field.onChange(null);

            return;
          }
          field.onChange(uploads.current.get(id) ?? value);
        },
        value: value?.fileId ?? null,
      }}
      file={value ? toFileValue(value, t("image_current")) : null}
      maxBytes={REACTIONS_LIMITS.imageMaxBytes}
      onUpload={async file => {
        const result = await uploadAdminReactionImage(file);
        if ("error" in result) {
          throw new Error(result.error.message ?? t("image_error"));
        }
        uploads.current.set(result.data.fileId, result.data);

        return toFileValue(result.data, file.name, file);
      }}
    />
  );
};
