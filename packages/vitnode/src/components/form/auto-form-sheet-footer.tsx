import { useSelector } from "@tanstack/react-form";
import { useTranslations } from "use-intl";

import { Button } from "../ui/button";
import { useFormApi } from "../ui/form";
import { SheetClose } from "../ui/sheet";

/**
 * The footer of an `AutoForm` in a `Sheet`: an "unsaved changes" note, Cancel
 * (closes the sheet) and Submit. Render it from the form's `layout`, below a
 * scrollable body.
 *
 * Submit stays disabled until a value differs from its default, and shows a
 * spinner while submitting. Closing the sheet after a successful save is the
 * caller's job.
 *
 * @example
 * ```tsx
 * <AutoForm
 *   fields={fields}
 *   formSchema={formSchema}
 *   onSubmit={onSubmit}
 *   layout={rendered => (
 *     <>
 *       <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
 *         {rendered.title}
 *       </div>
 *       <AutoFormSheetFooter submitLabel="Save" />
 *     </>
 *   )}
 * />
 * ```
 */
export const AutoFormSheetFooter = ({
  disabled = false,
  submitLabel,
}: {
  /** Disables Submit even with unsaved changes. Defaults to `false`. */
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
