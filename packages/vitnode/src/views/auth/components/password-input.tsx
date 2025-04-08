import { AutoFormLabel } from '@/components/form/common/label';
import { FormControl, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { CheckIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';

export const PasswordInput = ({
  value: valueFromProps,
  ...props
}: Omit<React.ComponentProps<typeof Input>, 'type'>) => {
  const t = useTranslations('core.auth.sign_up');
  const [openTooltip, setOpenTooltip] = React.useState(false);
  const value = valueFromProps?.toString() ?? '';
  const regexArray = [
    {
      regex: /^.{8,}$/.test(value),
      id: 'min_length' as const,
    },
    {
      regex: /[A-Z]/.test(value),
      id: 'uppercase' as const,
    },
    {
      regex: /\d/.test(value),
      id: 'number' as const,
    },
    {
      regex: /\W|_/.test(value),
      id: 'special_char' as const,
    },
  ];

  return (
    <FormItem>
      <AutoFormLabel>{t('password.label')}</AutoFormLabel>

      <TooltipProvider delayDuration={0}>
        <Tooltip open={openTooltip}>
          <TooltipTrigger asChild>
            <FormControl>
              <Input
                type="password"
                value={value}
                {...props}
                onBlur={e => {
                  setOpenTooltip(false);
                  props.onBlur?.(e);
                }}
                onFocus={e => {
                  setOpenTooltip(true);
                  props.onFocus?.(e);
                }}
              />
            </FormControl>
          </TooltipTrigger>
          <TooltipContent
            className="flex flex-col gap-2 text-sm"
            sideOffset={8}
          >
            <span className="text-based font-semibold">
              {t('password.requirements.label')}
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
    </FormItem>
  );
};
