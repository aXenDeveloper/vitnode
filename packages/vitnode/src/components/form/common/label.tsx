import { cn } from "cn";
import { useTranslations } from "use-intl";

import { FieldLabel } from "@/components/ui/field";
import { useFormField } from "@/components/ui/form";

export const AutoFormLabel = ({
  children,
  labelRight,
  className,
  isOptional,
  ...props
}: React.ComponentProps<typeof FieldLabel> & {
  isOptional?: boolean;
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
