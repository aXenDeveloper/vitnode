import { useTranslations } from "next-intl";

import { FieldLabel } from "@/components/ui/field";
import { useFormField } from "@/components/ui/form";
import { cn } from "@/lib/utils";

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
      {...props}
    >
      {children}
      {isOptional && (
        <span className="text-muted-foreground text-xs">{t("optional")}</span>
      )}
      {!!labelRight && <span className="ml-auto">{labelRight}</span>}
    </FieldLabel>
  );
};
