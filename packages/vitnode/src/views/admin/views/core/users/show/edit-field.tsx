"use client";

import { CheckIcon, MailIcon, PencilIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TooltipWithContent } from "@/components/ui/tooltip";
import { useRouter } from "@/lib/navigation";

import { mutationApi } from "./mutation-api";

export const EditUserField = ({
  nameCode,
  field,
  value,
  label,
  type = "text",
  as: Tag = "span",
  valueClassName,
  showUnverified = false,
}: {
  as?: "h2" | "span";
  field: "email" | "name";
  label: string;
  nameCode: string;
  showUnverified?: boolean;
  type?: "email" | "text";
  value: string;
  valueClassName?: string;
}) => {
  const t = useTranslations("admin.user");
  const tGlobal = useTranslations("core.global");
  const tError = useTranslations("core.global.errors");
  const router = useRouter();
  const [isEditing, setIsEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const [isPending, startTransition] = React.useTransition();

  const openEditor = () => {
    setDraft(value);
    setIsEditing(true);
  };

  const onSave = () => {
    const next = draft.trim();

    if (!next || next === value) {
      setIsEditing(false);

      return;
    }

    startTransition(async () => {
      const mutation = await mutationApi(nameCode, { [field]: next });

      if ("error" in mutation) {
        toast.error(tError("title"), {
          description:
            mutation.error.status === 409
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

      // Renaming regenerates the nameCode (the URL identifier), so follow it.
      if (mutation.data.nameCode !== nameCode) {
        router.replace(`/admin/core/users/${mutation.data.nameCode}`);
      }
    });
  };

  if (isEditing) {
    return (
      <form
        className="flex items-center gap-2"
        onSubmit={e => {
          e.preventDefault();
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
          onChange={e => {
            setDraft(e.target.value);
          }}
          onKeyDown={e => {
            if (e.key === "Escape") {
              setIsEditing(false);
            }
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
      <Button
        aria-label={label}
        onClick={openEditor}
        size="icon-sm"
        variant="secondary"
      >
        <PencilIcon />
      </Button>
    </div>
  );
};
