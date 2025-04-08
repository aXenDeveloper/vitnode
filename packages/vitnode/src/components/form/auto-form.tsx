'use client';

import { getDefaultValues, getObjectFormSchema } from '@/lib/helpers/auto-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { DefaultValues, Mode, useForm, UseFormReturn } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '../ui/button';
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
}: {
  fields: React.ComponentProps<typeof ItemAutoForm<T>>[];
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

  return (
    <Form form={form} onSubmit={onSubmit}>
      {fields.map(field => (
        <ItemAutoForm key={field.id} {...field} />
      ))}
      <Button
        disabled={!form.formState.isValid || form.formState.isSubmitting}
        isLoading={form.formState.isSubmitting}
        {...submitButtonProps}
        type="submit"
      >
        {submitButtonProps?.children ?? t('submit')}
      </Button>
    </Form>
  );
}
