import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";

import type { ContentContainerFormProps } from "./container-form-content";
import type {
  AdminContentContainer,
  ContentContainerMutationResult,
} from "./container-request";

import { contentContainerErrorKey } from "./container-query";

const ContentContainerFormContent = React.lazy(async () =>
  import("./container-form-content").then(module => ({
    default: module.ContentContainerFormContent,
  })),
);

export const ContentContainerSheet = ({
  formKey,
  onOpenChange,
  open,
  ...form
}: Omit<ContentContainerFormProps, "container"> & {
  container: AdminContentContainer | undefined;
  formKey: number;
  mode: "create" | "edit";
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) => {
  const t = useTranslations("core.containers");
  const { container, mode, ...rest } = form;
  const isEdit = mode === "edit";

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <SheetContent
        className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
        side="right"
      >
        <SheetHeader className="border-b pe-12">
          <SheetTitle className="text-balance">
            {t(isEdit ? "edit.title" : "create.title", {
              name: form.labels.singular,
            })}
          </SheetTitle>
          <SheetDescription className="truncate">
            {isEdit && container
              ? container.name
              : t("create.desc", { name: form.labels.singular })}
          </SheetDescription>
        </SheetHeader>

        {isEdit && !container ? null : (
          <React.Suspense
            fallback={
              <div className="flex flex-1 items-center justify-center p-6">
                <Spinner size="xl" />
              </div>
            }
          >
            <ContentContainerFormContent
              container={isEdit ? container : undefined}
              key={formKey}
              {...rest}
            />
          </React.Suspense>
        )}
      </SheetContent>
    </Dialog>
  );
};

const DeleteBody = ({
  childCount,
  container,
  onDelete,
  onOpenChange,
  singular,
}: {
  childCount: number;
  container: AdminContentContainer;
  onDelete: (id: number) => Promise<ContentContainerMutationResult<null>>;
  onOpenChange: (open: boolean) => void;
  singular: string;
}) => {
  const t = useTranslations("core.containers");
  const [isPending, startTransition] = React.useTransition();
  const [refusal, setRefusal] = React.useState<null | string>(() =>
    childCount > 0 ? t("errors.hasChildren") : null,
  );
  const refusalId = React.useId();

  const onConfirm = () => {
    startTransition(async () => {
      const result = await onDelete(container.id);

      if ("error" in result) {
        const message = t(contentContainerErrorKey(result.error));
        setRefusal(message);
        toast.error(t("delete.failed", { name: container.name }), {
          description: message,
        });

        return;
      }

      toast.success(t("delete.success", { name: singular }), {
        description: t("delete.successDesc", { name: container.name }),
      });
      onOpenChange(false);
    });
  };

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle className="text-balance">
          {t("delete.title", { name: singular })}
        </AlertDialogTitle>
        <AlertDialogDescription className="text-pretty">
          {t("delete.desc", { name: container.name })}
        </AlertDialogDescription>
      </AlertDialogHeader>

      {refusal ? (
        <p
          className="bg-destructive/10 text-destructive rounded-md p-3 text-sm leading-relaxed text-pretty"
          id={refusalId}
          role="alert"
        >
          {refusal}
        </p>
      ) : null}

      <AlertDialogFooter>
        <AlertDialogCancel>{t("delete.cancel")}</AlertDialogCancel>
        <Button
          aria-describedby={refusal ? refusalId : undefined}
          disabled={childCount > 0}
          isLoading={isPending}
          onClick={onConfirm}
          type="button"
          variant="destructive"
        >
          {t("delete.confirm")}
        </Button>
      </AlertDialogFooter>
    </>
  );
};

export const ContentContainerDeleteDialog = ({
  container,
  onOpenChange,
  open,
  ...props
}: Omit<React.ComponentProps<typeof DeleteBody>, "container"> & {
  container: AdminContentContainer | undefined;
  open: boolean;
}) => (
  <AlertDialog onOpenChange={onOpenChange} open={open}>
    <AlertDialogContent>
      {container ? (
        <DeleteBody
          container={container}
          key={container.id}
          onOpenChange={onOpenChange}
          {...props}
        />
      ) : null}
    </AlertDialogContent>
  </AlertDialog>
);
