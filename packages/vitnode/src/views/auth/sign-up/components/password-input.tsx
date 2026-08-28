import { CheckIcon, XIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import type { ItemAutoFormComponentProps } from "@/components/form/auto-form";

import { AutoFormLabel } from "@/components/form/common/label";
import { FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const PasswordInput = ({
  label,
  labelRight,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  description: _description,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  itemParams: _itemParams,
  field,
  otherProps: { isOptional, maxLength, minLength, pattern },
  ...props
}: ItemAutoFormComponentProps &
  Omit<React.ComponentProps<typeof Input>, "type">) => {
  const t = useTranslations("core.auth.sign_up");
  const [openTooltip, setOpenTooltip] = React.useState(false);
  const value: string = field.value ?? "";
  const regexArray = [
    {
      regex: /^.{8,}$/.test(value),
      id: "min_length" as const,
    },
    {
      regex: /[A-Z]/.test(value),
      id: "uppercase" as const,
    },
    {
      regex: /\d/.test(value),
      id: "number" as const,
    },
    {
      regex: /\W|_/.test(value),
      id: "special_char" as const,
    },
  ];

  return (
    <>
      <AutoFormLabel isOptional={isOptional} labelRight={labelRight}>
        {label}
      </AutoFormLabel>

      <TooltipProvider delay={0}>
        <Tooltip open={openTooltip}>
          <TooltipTrigger
            render={
              <FormControl>
                <Input
                  type="password"
                  {...field}
                  maxLength={maxLength ?? props.maxLength}
                  minLength={minLength ?? props.minLength}
                  onBlur={e => {
                    setOpenTooltip(false);
                    field.onBlur();
                    props.onBlur?.(e);
                  }}
                  onChange={e => {
                    setOpenTooltip(true);
                    field.onChange(e);
                    props.onChange?.(e);
                  }}
                  pattern={pattern ?? props.pattern}
                  value={field.value ?? ""}
                  {...props}
                />
              </FormControl>
            }
          />
          <TooltipContent
            className="flex flex-col gap-2 text-sm"
            sideOffset={8}
          >
            <span className="text-based font-semibold">
              {t("password.requirements.label")}
            </span>
            <ul className="space-y-1">
              {regexArray.map(({ regex, id }) => (
                <li className="flex items-center gap-1" key={id}>
                  {regex ? (
                    <CheckIcon className="size-4" />
                  ) : (
                    <XIcon className="size-4" />
                  )}

                  {t(`password.requirements.${id}`)}
                </li>
              ))}
            </ul>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <FormMessage />
    </>
  );
};
