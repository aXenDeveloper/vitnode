import { cn } from "cn";
import React from "react";
import { useTranslations } from "use-intl";

import { FieldLabel } from "@/components/ui/field";
import { useFormField } from "@/components/ui/form";

import { AutoFormLabelAddonContext } from "./label-addon";

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
  const addon = React.use(AutoFormLabelAddonContext);

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
      {addon ? (
        <span aria-hidden className="inline-flex items-center">
          {addon}
        </span>
      ) : null}
      {isOptional && (
        <span className="text-muted-foreground text-xs">{t("optional")}</span>
      )}
      {!!labelRight && <span className="ms-auto">{labelRight}</span>}
    </FieldLabel>
  );
};
