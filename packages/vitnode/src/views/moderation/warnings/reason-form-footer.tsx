import type React from "react";

import { useSelector } from "@tanstack/react-form";
import { useTranslations } from "use-intl";

import { AutoFormSubmitButton } from "@/components/form/auto-form";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
import { useFormApi } from "@/components/ui/form";

export const ReasonFormFooter = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const t = useTranslations("core.global");
  const { form } = useFormApi();
  const empty = useSelector(form.store, state => {
    const { reason } = state.values as { reason?: unknown };

    return typeof reason !== "string" || reason.trim() === "";
  });

  return (
    <DialogFooter>
      <DialogClose render={<Button variant="ghost">{t("cancel")}</Button>} />
      <AutoFormSubmitButton disabled={empty}>{children}</AutoFormSubmitButton>
    </DialogFooter>
  );
};
