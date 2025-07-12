'use client';

import type { DefaultValues, Mode, UseFormReturn } from 'react-hook-form';
import type { z } from 'zod';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';

import { getDefaultValues, getObjectFormSchema } from '@/lib/helpers/auto-form';

import type { routeMiddlewareSchema } from '../../api/modules/middleware/route';
import type { ItemAutoFormProps } from './fields/item';

import { useCaptcha } from '../../hooks/use-captcha';
import { Button } from '../ui/button';
import { DialogClose, DialogFooter, useDialog } from '../ui/dialog';
import { Form } from '../ui/form';
import { ItemAutoForm } from './fields/item';

export type AutoFormOnSubmit<T extends z.ZodTypeAny> = (
  values: z.infer<T>,
  form: UseFormReturn<z.infer<T>>,
  options: {
    captchaToken: string;
  },
) => Promise<void> | void;

export function AutoForm<
  T extends
    | z.ZodEffects<z.ZodObject<z.ZodRawShape>>
    | z.ZodObject<z.ZodRawShape>,
  TContext = unknown,
>({
  formSchema,
  onSubmit: onSubmitProp,
  fields,
  submitButtonProps,
  mode,
  captcha,
  ...props
}: Omit<React.ComponentProps<'form'>, 'onSubmit'> & {
  captcha?: z.infer<typeof routeMiddlewareSchema>['captcha'];
  fields: ItemAutoFormProps<T>[];
  formSchema: T;
  mode?: Mode;
  onSubmit?: AutoFormOnSubmit<T>;
  submitButtonProps?: Omit<
    React.ComponentProps<typeof Button>,
    'isLoading' | 'type'
  >;
}) {
  const {
    isReady,
    getToken: getTokenCaptcha,
    onReset: onResetCaptcha,
  } = useCaptcha(captcha);
  const { setIsDirty } = useDialog();
  const objectFormSchema = getObjectFormSchema(formSchema);
  const defaultValues = getDefaultValues(objectFormSchema) as DefaultValues<
    z.infer<T>
  >;
  const t = useTranslations('core.global');
  const form = useForm<z.infer<T>, TContext>({
    resolver: zodResolver(formSchema),
    defaultValues,
    mode,
  });

  const onSubmit = async (values: z.infer<T>) => {
    const parsedValues = formSchema.safeParse(values);
    if (parsedValues.success) {
      await onSubmitProp?.(parsedValues.data as z.infer<T>, form, {
        captchaToken: captcha ? await getTokenCaptcha() : '',
      });

      if (captcha) {
        onResetCaptcha();
      }
    }
  };

  const submitButton = (
    <Button
      disabled={
        !form.formState.isValid ||
        form.formState.isSubmitting ||
        (captcha && !isReady)
      }
      isLoading={form.formState.isSubmitting}
      {...submitButtonProps}
      aria-label={submitButtonProps?.['aria-label'] ?? t('submit')}
      type="submit"
    >
      {submitButtonProps?.children ?? t('submit')}
    </Button>
  );

  return (
    <Form form={form} onSubmit={onSubmit} {...props}>
      {fields.map(field => (
        <ItemAutoForm formSchema={formSchema} key={field.id} {...field} />
      ))}
      {captcha && <div id="vitnode_captcha" />}
      {setIsDirty ? (
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">{t('cancel')}</Button>
          </DialogClose>
          {submitButton}
        </DialogFooter>
      ) : (
        submitButton
      )}
    </Form>
  );
}
