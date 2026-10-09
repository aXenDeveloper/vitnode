import { useSelector } from "@tanstack/react-form";
import { useTranslations } from "use-intl";

import { Button } from "../ui/button";
import { useFormApi } from "../ui/form";
import { SheetClose } from "../ui/sheet";

export const AutoFormSheetFooter = ({
  disabled = false,
  submitLabel,
}: {
  disabled?: boolean;
  submitLabel: string;
}) => {
  const t = useTranslations("core.global");
  const { form } = useFormApi();
  const isDirty = useSelector(form.store, state => !state.isDefaultValue);
  const isSubmitting = useSelector(form.store, state => state.isSubmitting);

  return (
    <div className="bg-popover flex items-center justify-between gap-3 border-t p-4 pb-[max(--spacing(4),env(safe-area-inset-bottom))]">
      <p aria-live="polite" className="text-muted-foreground text-sm">
        {isDirty ? t("unsaved_changes") : null}
      </p>
      <div className="flex items-center gap-2">
        <SheetClose render={<Button variant="ghost">{t("cancel")}</Button>} />
        <Button
          disabled={disabled || !isDirty}
          isLoading={isSubmitting}
          type="submit"
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
};
