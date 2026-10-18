import { cn } from "cn";
import { useTranslations } from "use-intl";

import { FieldLabel } from "@/components/ui/field";
import { useFormField } from "@/components/ui/form";

/**
 * A form field's label, linked to the field's control by id. Render it inside
 * a form field, above the control, in a custom field component.
 */
export const AutoFormLabel = ({
  children,
  labelRight,
  className,
  isOptional,
  ...props
}: React.ComponentProps<typeof FieldLabel> & {
  /** Appends the translated "optional" hint after the label. */
  isOptional?: boolean;
  /** Content pushed to the end of the label row, e.g. a language switcher. */
  labelRight?: React.ReactNode;
}) => {
  const t = useTranslations("core.global");
  const { formItemId } = useFormField();

  return (
    <FieldLabel
      className={cn(
        {
          "flex flex-wrap items-center": labelRight,
        },
        className,
      )}
      htmlFor={formItemId}
      id={`${formItemId}-label`}
      {...props}
    >
      {children}
      {isOptional && (
        <span className="text-muted-foreground text-xs">{t("optional")}</span>
      )}
      {!!labelRight && <span className="ms-auto">{labelRight}</span>}
    </FieldLabel>
  );
};
