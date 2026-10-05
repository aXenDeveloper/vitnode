import { CheckIcon, LinkIcon, MailIcon, PencilIcon, XIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";
import type { AdminUserUpdateInput } from "@/views/admin/views/core/users/users-mutations";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { TooltipWithContent } from "@/components/ui/tooltip";

import { EditSheetContent } from "./edit-sheet-content";

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
        <TooltipWithContent text={tGlobal("save")}>
          <Button
            aria-label={tGlobal("save")}
            isLoading={isPending}
            size="icon-sm"
            type="submit"
          >
            <CheckIcon />
          </Button>
        </TooltipWithContent>
        <TooltipWithContent text={tGlobal("cancel")}>
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
        </TooltipWithContent>
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
        <TooltipWithContent text={label}>
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
        </TooltipWithContent>
      )}
    </div>
  );
};

const NameCodeForm = React.lazy(async () =>
  import("./name-code-form").then(module => ({
    default: module.NameCodeForm,
  })),
);

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
      <TooltipWithContent text={t("editNameCode")}>
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
      </TooltipWithContent>

      <EditSheetContent
        description={t("editNameCodeDesc")}
        title={
          <>
            <LinkIcon className="size-5" />
            {t("editNameCode")}
          </>
        }
      >
        <Alert variant="warning">
          <AlertTitle>{t("editNameCodeWarningTitle")}</AlertTitle>
          <AlertDescription>{t("editNameCodeWarning")}</AlertDescription>
        </Alert>

        <NameCodeForm id={id} nameCode={nameCode} onUpdate={onUpdate} />
      </EditSheetContent>
    </Dialog>
  );
};
