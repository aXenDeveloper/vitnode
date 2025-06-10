'use client';

import type { DefaultValues, Mode, UseFormReturn } from 'react-hook-form';
import type { z } from 'zod';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';

import { getDefaultValues, getObjectFormSchema } from '@/lib/helpers/auto-form';

import type { ItemAutoFormProps } from './fields/item';

import { Button } from '../ui/button';
import { DialogClose, DialogFooter, useDialog } from '../ui/dialog';
import { Form } from '../ui/form';
import { ItemAutoForm } from './fields/item';

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
  ...props
}: Omit<React.ComponentProps<'form'>, 'onSubmit'> & {
  fields: ItemAutoFormProps<T>[];
  formSchema: T;
  mode?: Mode;
  onSubmit?: (
    values: z.infer<T>,
    form: UseFormReturn<z.infer<T>>,
  ) => Promise<void> | void;
  submitButtonProps?: Omit<
    React.ComponentProps<typeof Button>,
    'isLoading' | 'type'
  >;
}) {
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
      await onSubmitProp?.(parsedValues.data as z.infer<T>, form);
    }
  };

  const submitButton = (
    <Button
      disabled={!form.formState.isValid || form.formState.isSubmitting}
      isLoading={form.formState.isSubmitting}
      {...submitButtonProps}
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
      {setIsDirty ? (
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t('cancel')}</Button>
          </DialogClose>
          {submitButton}
        </DialogFooter>
      ) : (
        submitButton
      )}
    </Form>
  );
}
