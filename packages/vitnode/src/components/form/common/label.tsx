import { cn } from "cn";
import { useTranslations } from "use-intl";

import { FieldLabel } from "@/components/ui/field";
import { useFormField } from "@/components/ui/form";

import { AutoFormTip, hasTipContent } from "./tip";

/**
 * A form field's label, linked to the field's control by id. Render it inside
 * a form field, above the control, in a custom field component.
 *
 * With a `tip`, the label sits in a row with a help button right after it,
 * then the "optional" hint and `labelRight`. The button is a sibling of the
 * `label`, so pressing it never focuses or toggles the control.
 */
export const AutoFormLabel = ({
  children,
  labelRight,
  className,
  isOptional,
  tip,
  ...props
}: React.ComponentProps<typeof FieldLabel> & {
  /** Appends the translated "optional" hint after the label. */
  isOptional?: boolean;
  /** Content pushed to the end of the label row, e.g. a language switcher. */
  labelRight?: React.ReactNode;
  /** Extra help opened from a question-mark button beside the label. Empty content renders no button. */
  tip?: React.ReactNode;
}) => {
  const t = useTranslations("core.global");
  const { formItemId } = useFormField();
  const labelId = props.id ?? `${formItemId}-label`;

  if (!hasTipContent(tip)) {
    return (
      <FieldLabel
        className={cn(
          {
            "flex flex-wrap items-center": labelRight,
          },
          className,
        )}
        htmlFor={formItemId}
        id={labelId}
        {...props}
      >
        {children}
        {isOptional && (
          <span className="text-muted-foreground text-xs">{t("optional")}</span>
        )}
        {!!labelRight && <span className="ms-auto">{labelRight}</span>}
      </FieldLabel>
    );
  }

  return (
    <div
      className="flex flex-wrap items-center gap-x-2 gap-y-1"
      data-slot="auto-form-label-row"
    >
      {/* A long label wraps its own text, so the icon never drops to a line of its own. */}
      <div className="flex min-w-0 items-center gap-2">
        <FieldLabel
          className={cn("min-w-0", className)}
          htmlFor={formItemId}
          id={labelId}
          {...props}
        >
          {children}
          {isOptional && <span className="sr-only">{t("optional")}</span>}
        </FieldLabel>
        <AutoFormTip labelId={labelId}>{tip}</AutoFormTip>
        {isOptional && (
          <span aria-hidden className="text-muted-foreground shrink-0 text-xs">
            {t("optional")}
          </span>
        )}
      </div>
      {!!labelRight && <span className="ms-auto">{labelRight}</span>}
    </div>
  );
};
