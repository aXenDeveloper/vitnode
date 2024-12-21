'use client';

import { cn } from '@/helpers/classnames';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import React from 'react';
import {
  ControllerRenderProps,
  FieldPath,
  useForm,
  UseFormReturn,
} from 'react-hook-form';
import { z } from 'zod';

import { Button } from '../ui/button';
import { useDialog } from '../ui/dialog';
import { Form } from '../ui/form';
import { ItemAutoForm } from './fields/utils/item';
import { Dependency, getDefaultValues, getObjectFormSchema } from './utils';

export enum DependencyType {
  DISABLES,
  REQUIRES,
  HIDES,
  SETS_OPTIONS,
}

export interface AutoFormComponentProps {
  description: React.ReactNode | string | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  field: ControllerRenderProps<Record<string, any>>;
  hideOptionalLabel: boolean | undefined;
  isDisabled: boolean;
  isRequired: boolean;
  label: React.ReactNode | string;
  overrideOptions: undefined | z.EnumValues;
  shape: z.ZodAny;
  theme: 'horizontal' | 'vertical';
  zodInputProps: React.InputHTMLAttributes<
    HTMLInputElement | HTMLTextAreaElement
  >;
}

export function AutoForm<
  T extends
    | z.ZodEffects<z.ZodObject<z.ZodRawShape>>
    | z.ZodObject<z.ZodRawShape>,
>({
  formSchema,
  fields,
  onSubmit: onSubmitProp,
  className,
  theme = 'vertical',
  dependencies = [],
  submitButton,
  children,
  onValuesChange,
}: {
  children?: React.ReactNode;
  className?: string;
  dependencies?: Dependency<z.infer<T>>[];
  fields: {
    className?: string;
    component: (props: AutoFormComponentProps) => React.ReactNode;
    description?: React.ReactNode | string;
    hideOptionalLabel?: boolean;
    id: FieldPath<z.infer<T>>;
    label?: React.ReactNode | string;
  }[];
  formSchema: T;
  onSubmit?: (
    values: z.infer<T>,
    form: UseFormReturn<z.infer<T>>,
  ) => Promise<void> | void;
  onValuesChange?: (values: z.infer<T>) => void;
  submitButton?: (props: {
    disabled: boolean;
    loading: boolean;
    type: 'submit';
  }) => React.ReactNode;
  theme?: 'horizontal' | 'vertical';
}) {
  const { setOpen } = useDialog();
  const t = useTranslations('core.global');
  const objectFormSchema = React.useMemo(
    () => getObjectFormSchema(formSchema),
    [formSchema],
  );
  const defaultValues = React.useMemo(
    () => getDefaultValues(objectFormSchema),
    [objectFormSchema],
  );
  const form = useForm<z.infer<typeof objectFormSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const parsedValues = formSchema.safeParse(values);
    if (parsedValues.success) {
      await onSubmitProp?.(parsedValues.data as z.infer<T>, form);
    }
  };

  const values = form.watch();
  // valuesString is needed because form.watch() returns a new object every time
  const valuesString = JSON.stringify(values);

  React.useEffect(() => {
    onValuesChange?.(values);
  }, [valuesString]);

  return (
    <Form {...form}>
      <form
        className={cn('min-w-0 space-y-6', className, {
          '@container flex flex-col items-start [&>a:last-child]:self-end [&>button:last-child]:self-end':
            theme === 'horizontal',
        })}
        onSubmit={form.handleSubmit(onSubmit)}
      >
        {fields.map(item => {
          return (
            <ItemAutoForm
              control={form.control}
              dependencies={dependencies}
              formSchema={formSchema}
              key={item.id}
              theme={theme}
              watch={form.watch}
              {...item}
            />
          );
        })}

        {children}
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          {setOpen ? (
            <Button
              disabled={form.formState.isSubmitting}
              onClick={() => {
                setOpen(false);
              }}
              variant="ghost"
            >
              {t('cancel')}
            </Button>
          ) : null}
          {submitButton ? (
            submitButton({
              disabled: !form.formState.isValid,
              loading: form.formState.isSubmitting,
              type: 'submit',
            })
          ) : (
            <Button
              disabled={!form.formState.isValid}
              loading={form.formState.isSubmitting}
              type="submit"
            >
              {t('save')}
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
