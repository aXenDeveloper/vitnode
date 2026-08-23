"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { z } from "zod";

import { AutoForm, type AutoFormOnSubmit } from "@/components/form/auto-form";
import { AutoFormFiles } from "@/components/form/fields/files";
import { useDialog } from "@/components/ui/dialog";
import { uploadedFilesSchema } from "@/lib/helpers/files";
import { useRouter } from "@/lib/navigation";

const formSchema = z.object({
  files: uploadedFilesSchema({ min: 1 }),
});

export const UploadMyFilesForm = () => {
  const t = useTranslations("core.files.upload");
  const { setOpen } = useDialog();
  const router = useRouter();

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = ({ files }) => {
    toast.success(t("success", { count: files.length }));
    setOpen?.(false);
    router.refresh();
  };

  return (
    <AutoForm
      fields={[
        {
          id: "files",
          component: props => (
            <AutoFormFiles
              {...props}
              label={t("field")}
              // Every batch is stored the moment it is picked, so the table
              // behind the dialog is out of date before the form is submitted.
              onRemoved={() => router.refresh()}
              onUploaded={() => router.refresh()}
            />
          ),
        },
      ]}
      formSchema={formSchema}
      onSubmit={onSubmit}
      submitButtonProps={{ children: t("submit") }}
    />
  );
};
