'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import {
  type ControllerRenderProps,
  type FieldPath,
  type FieldValues,
  type Mode,
  type UseFormReturn,
  useForm,
} from 'react-hook-form';
import z from 'zod';
import type { routeMiddlewareSchema } from '../../api/modules/middleware/route';
import { useCaptcha } from '../../hooks/use-captcha';
import {
  getDefaults,
  getNestedParam,
  getZodInputParams,
} from '../../lib/helpers/auto-form';
import { Button } from '../ui/button';
import { DialogClose, DialogFooter, useDialog } from '../ui/dialog';
import { Form, FormField } from '../ui/form';

type ItemAutoFormProps<
  T extends z.ZodObject<z.ZodRawShape> = z.ZodObject<z.ZodRawShape>,
  TName extends FieldPath<z.infer<T>> = FieldPath<z.infer<T>>,
> =
  | {
      component: (props: ItemAutoFormComponentProps) => React.ReactNode;
      id: TName;
    }
  | {
      component?: never;
      description?: React.ReactNode;
      id: TName;
      label?: React.ReactNode;
    };

export interface ItemAutoFormComponentProps {
  description?: React.ReactNode;
  field: ControllerRenderProps<FieldValues, string>;
  label?: React.ReactNode;
  labelRight?: React.ReactNode;
  otherProps: {
    enum?: string[];
    isOptional?: boolean;
    maxLength?: number;
    minLength?: number;
    pattern?: string;
    type?: string;
  };
}

export type AutoFormOnSubmit<
  T extends z.ZodObject<z.ZodRawShape>,
  TContext = unknown,
> = (
  values: z.infer<T>,
  form: UseFormReturn<z.input<T>, TContext, z.output<T>>,
  options: {
    captchaToken: string;
  },
) => Promise<void> | void;

export function AutoForm<
  T extends z.ZodObject<z.ZodRawShape>,
  TContext = unknown,
>({
  formSchema,
  mode,
  onSubmit: onSubmitProp,
  captcha,
  fields,
  submitButtonProps,
  children,
  ...props
}: Omit<React.ComponentProps<'form'>, 'onSubmit'> & {
  captcha?: z.infer<typeof routeMiddlewareSchema>['captcha'];
  fields: ItemAutoFormProps<T>[];
  formSchema: T;
  mode?: Mode;
  onSubmit?: AutoFormOnSubmit<T, TContext>;
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
  const t = useTranslations('core.global');
  const jsonSchema: z.core.JSONSchema.JSONSchema = z.toJSONSchema(formSchema);
  const inputParams = getZodInputParams(jsonSchema);
  const form = useForm<z.core.input<T>, TContext, z.core.output<T>>({
    resolver: zodResolver(formSchema),
    defaultValues: getDefaults<T>(jsonSchema),
    mode,
  });

  const onSubmit = async (values: z.infer<T>) => {
    const parsedValues = formSchema.safeParse(values);
    if (parsedValues.success) {
      await onSubmitProp?.(parsedValues.data, form, {
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
      {fields.map(item => {
        const params = getNestedParam(inputParams, item.id);
        if (!params) return null;

        if (!item.component && (item.label || item.description)) {
          return (
            <div key={item.id}>
              {item.label && (
                <span className="text-xl font-semibold leading-none tracking-tight">
                  {item.label}
                </span>
              )}
              {item.description && (
                <div className="text-muted-foreground text-sm">
                  {item.description}
                </div>
              )}
            </div>
          );
        }

        if (!item.component) return null;

        return (
          <FormField
            key={item.id}
            name={item.id}
            // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <needed>
            render={({ field }) => {
              return (
                <>
                  {item.component({
                    field,
                    description:
                      typeof params.description === 'string'
                        ? params.description
                        : '',
                    otherProps: {
                      isOptional: !params.required,
                      enum: Array.isArray(params.enum)
                        ? params.enum
                        : undefined,
                      maxLength:
                        typeof params.maxLength === 'number'
                          ? params.maxLength
                          : undefined,
                      minLength:
                        typeof params.minLength === 'number'
                          ? params.minLength
                          : undefined,
                      pattern:
                        typeof params.pattern === 'string'
                          ? params.pattern
                          : undefined,
                      type:
                        typeof params.type === 'string'
                          ? params.type
                          : undefined,
                    },
                  })}
                </>
              );
            }}
          />
        );
      })}

      {children}

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
