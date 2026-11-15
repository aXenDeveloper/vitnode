import type { UserImageKind } from "@vitnode/api/lib/shared/user-images";

import { useMutation } from "@tanstack/react-query";
import {
  USER_IMAGE_MIME_TYPES,
  USER_IMAGE_OUTPUT,
} from "@vitnode/api/lib/shared/user-images";
import React from "react";

import { FileError } from "@/components/form/fields/file-shared";
import { ImageCropFields } from "@/components/image-crop/image-crop-fields";
import { useImageCrop } from "@/components/image-crop/use-image-crop";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter, useDialog } from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export type UserImageAction = "remove" | "upload";

export interface UserImageDialogLabels {
  cancel: string;
  chooseAction: string;
  confirmRemove: string;
  confirmUpload: string;
  desc: string;
  remove: string;
  removeDesc: string;
  title: string;
  upload: string;
  uploadDesc?: string;
}

export interface UserImageDialogContentProps {
  canUpload: boolean;
  hasImage: boolean;
  kind: UserImageKind;
  labels: UserImageDialogLabels;
  maxBytes: number;
  onRemove: () => Promise<void>;
  onUpload: (file: File) => Promise<void>;
}

const messageOf = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message !== "" ? error.message : fallback;

const ActionOption = ({
  description,
  disabled,
  id,
  label,
  value,
}: {
  description?: string;
  disabled: boolean;
  id: string;
  label: string;
  value: UserImageAction;
}) => (
  <FieldLabel htmlFor={id}>
    <Field data-disabled={disabled} orientation="horizontal">
      <FieldContent>
        <FieldTitle>{label}</FieldTitle>
        {description ? (
          <FieldDescription>{description}</FieldDescription>
        ) : null}
      </FieldContent>
      <RadioGroupItem disabled={disabled} id={id} value={value} />
    </Field>
  </FieldLabel>
);

export const UserImageDialogContent = ({
  canUpload,
  hasImage,
  kind,
  labels,
  maxBytes,
  onRemove,
  onUpload,
}: UserImageDialogContentProps) => {
  const { setIsDirty, setOpen } = useDialog();
  const [action, setAction] = React.useState<UserImageAction>(
    canUpload ? "upload" : "remove",
  );
  const output = USER_IMAGE_OUTPUT[kind];
  const constraints = {
    allowedMimeTypes: USER_IMAGE_MIME_TYPES,
    maxBytes,
  };

  const crop = useImageCrop({
    constraints,
    fileName: kind,
    onSourceChange: hasSource => {
      setIsDirty?.(hasSource);
    },
    output: { height: output.height, width: output.width },
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (hasImage && action === "remove") {
        await onRemove();

        return;
      }

      await onUpload(await crop.toFile());
    },
    onError: error => {
      crop.setError(messageOf(error, labels.desc));
    },
    onSuccess: () => {
      setIsDirty?.(false);
      setOpen?.(false);
    },
    retry: false,
  });

  const isRemoving = hasImage && action === "remove";
  const canSubmit = isRemoving ? hasImage : canUpload && crop.source !== null;

  return (
    <div className="flex flex-col gap-4">
      {hasImage ? (
        <RadioGroup
          aria-label={labels.chooseAction}
          onValueChange={value => {
            crop.setError(null);
            setAction(value === "remove" ? "remove" : "upload");
          }}
          value={action}
        >
          <ActionOption
            description={labels.uploadDesc}
            disabled={!canUpload}
            id={`${kind}-action-upload`}
            label={labels.upload}
            value="upload"
          />

          <ActionOption
            description={labels.removeDesc}
            disabled={!hasImage}
            id={`${kind}-action-remove`}
            label={labels.remove}
            value="remove"
          />
        </RadioGroup>
      ) : null}

      {isRemoving ? (
        crop.error ? (
          <FileError>{crop.error}</FileError>
        ) : null
      ) : (
        <ImageCropFields
          aspect={output.aspect}
          constraints={constraints}
          crop={crop}
          disabled={!canUpload || submit.isPending}
          shape={output.shape}
        />
      )}

      <DialogFooter>
        <DialogClose
          render={<Button variant="ghost">{labels.cancel}</Button>}
        />
        <Button
          disabled={!canSubmit || submit.isPending}
          isLoading={submit.isPending}
          onClick={() => {
            submit.mutate();
          }}
          type="button"
          variant={isRemoving ? "destructive" : "default"}
        >
          {isRemoving ? labels.confirmRemove : labels.confirmUpload}
        </Button>
      </DialogFooter>
    </div>
  );
};
