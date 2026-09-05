"use client";

import {
  CheckIcon,
  ImageIcon,
  LinkIcon,
  MailIcon,
  PencilIcon,
  Trash2Icon,
  TriangleAlertIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";
import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";
import type { AdminUserUpdateInput } from "@/views/admin/views/core/users/users-mutations";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormInput } from "@/components/form/fields/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  useDialog,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { TooltipWithContent } from "@/components/ui/tooltip";

/** How the page performs a user update. Supplied by whichever app mounts this. */
export type UpdateAdminUser = (
  id: number,
  input: AdminUserUpdateInput,
) => Promise<AdminMutationResult<{ nameCode: string }>>;

export const EditUserFieldContent = ({
  as: Tag = "span",
  canEdit = true,
  field,
  id,
  label,
  onUpdate,
  showUnverified = false,
  type = "text",
  value,
  valueClassName,
}: {
  as?: "h2" | "span";
  canEdit?: boolean;
  field: "email" | "name";
  id: number;
  label: string;
  onUpdate: UpdateAdminUser;
  showUnverified?: boolean;
  type?: "email" | "text";
  value: string;
  valueClassName?: string;
}) => {
  const t = useTranslations("admin.user");
  const tGlobal = useTranslations("core.global");
  const tError = useTranslations("core.global.errors");
  const [isEditing, setIsEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const [isPending, startTransition] = React.useTransition();

  const onSave = () => {
    const next = draft.trim();

    if (!next || next === value) {
      setIsEditing(false);

      return;
    }

    startTransition(async () => {
      const result = await onUpdate(id, { [field]: next });

      if ("error" in result) {
        toast.error(tError("title"), {
          description:
            result.error.status === 409
              ? t(
                  field === "email"
                    ? "create.email.exists"
                    : "create.name.exists",
                )
              : tError("internal_server_error"),
        });

        return;
      }

      toast.success(t("show.updateSuccess"));
      setIsEditing(false);
    });
  };

  if (isEditing) {
    return (
      <form
        className="flex items-center gap-2"
        onSubmit={event => {
          event.preventDefault();
          onSave();
        }}
      >
        <Input
          aria-label={label}
          autoFocus
          className="flex-1"
          disabled={isPending}
          minLength={type === "email" ? undefined : 3}
          name={field}
          onChange={event => {
            setDraft(event.target.value);
          }}
          onKeyDown={event => {
            if (event.key === "Escape") setIsEditing(false);
          }}
          required
          type={type}
          value={draft}
        />
        <Button
          aria-label={tGlobal("save")}
          isLoading={isPending}
          size="icon-sm"
          type="submit"
        >
          <CheckIcon />
        </Button>
        <Button
          aria-label={tGlobal("cancel")}
          disabled={isPending}
          onClick={() => {
            setIsEditing(false);
          }}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <XIcon />
        </Button>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <Tag className={valueClassName}>{value}</Tag>
        {showUnverified && (
          <TooltipWithContent text={t("show.emailNotVerified")}>
            <MailIcon className="text-destructive size-5 shrink-0" />
          </TooltipWithContent>
        )}
      </div>
      {canEdit && (
        <Button
          aria-label={label}
          onClick={() => {
            setDraft(value);
            setIsEditing(true);
          }}
          size="icon-sm"
          variant="secondary"
        >
          <PencilIcon />
        </Button>
      )}
    </div>
  );
};

/** The avatar/cover menu. Presentational - uploading is not built yet. */
export const EditImageButtonContent = ({ label }: { label: string }) => {
  const t = useTranslations("admin.user.show");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button aria-label={label} size="icon-sm" variant="outline" />}
      >
        <ImageIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem>
          <UploadIcon />
          {t("uploadImage")}
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive">
          <Trash2Icon />
          {t("removeImage")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const NameCodeForm = ({
  id,
  nameCode,
  onUpdate,
}: {
  id: number;
  nameCode: string;
  onUpdate: UpdateAdminUser;
}) => {
  const t = useTranslations("admin.user.show");
  const tError = useTranslations("core.global.errors");
  const { setIsDirty, setOpen } = useDialog();

  const formSchema = z.object({
    currentNameCode: z
      .string({ message: tError("field_required") })
      .refine(value => value === nameCode, t("nameCodeConfirmMismatch"))
      .default(""),
    newNameCode: z
      .string({ message: tError("field_required") })
      .min(3, tError("field_min_length", { min: 3 }))
      .max(255)
      .regex(/^[a-zA-Z0-9-]+$/, t("nameCodeInvalid"))
      .refine(value => value !== nameCode, t("nameCodeSame"))
      .default(""),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async (
    values,
    form,
  ) => {
    const result = await onUpdate(id, { nameCode: values.newNameCode });

    if ("data" in result) {
      setIsDirty?.(false);
      setOpen?.(false);
      toast.success(t("updateSuccess"));

      return;
    }

    if (result.error.status === 409) {
      form.setError(
        "newNameCode",
        { message: t("nameCodeExists"), type: "manual" },
        { shouldFocus: true },
      );

      return;
    }

    toast.error(tError("title"), {
      description: tError("internal_server_error"),
    });
  };

  return (
    <AutoForm
      fields={[
        {
          component: props => (
            <AutoFormInput
              autoComplete="off"
              label={t.rich("confirmNameCode", {
                bold: chunks => <span className="font-semibold">{chunks}</span>,
                nameCode: () => <code className="font-mono">{nameCode}</code>,
              })}
              {...props}
            />
          ),
          id: "currentNameCode",
        },
        {
          component: props => (
            <AutoFormInput label={t("newNameCode")} {...props} />
          ),
          id: "newNameCode",
        },
      ]}
      formSchema={formSchema}
      mode="all"
      onSubmit={onSubmit}
      submitButtonProps={{
        children: t("saveNameCode"),
        variant: "destructive",
      }}
    />
  );
};

export const EditNameCodeContent = ({
  id,
  nameCode,
  onUpdate,
}: {
  id: number;
  nameCode: string;
  onUpdate: UpdateAdminUser;
}) => {
  const t = useTranslations("admin.user.show");

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            aria-label={t("editNameCode")}
            size="icon-xs"
            variant="ghost"
          />
        }
      >
        <PencilIcon />
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="size-5" />
            {t("editNameCode")}
          </DialogTitle>
          <DialogDescription>{t("editNameCodeDesc")}</DialogDescription>
        </DialogHeader>

        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>{t("editNameCodeWarningTitle")}</AlertTitle>
          <AlertDescription>{t("editNameCodeWarning")}</AlertDescription>
        </Alert>

        <NameCodeForm id={id} nameCode={nameCode} onUpdate={onUpdate} />
      </DialogContent>
    </Dialog>
  );
};
