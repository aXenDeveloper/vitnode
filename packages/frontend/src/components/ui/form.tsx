'use client';

import { useBeforeUnload } from '@/hooks/use-before-unload';
import * as LabelPrimitive from '@radix-ui/react-label';
import { Slot } from '@radix-ui/react-slot';
import { useTranslations } from 'next-intl';
import React from 'react';
import {
  Controller,
  ControllerProps,
  FieldPath,
  FieldValues,
  FormProvider,
  FormProviderProps,
  useFormContext,
} from 'react-hook-form';

import { cn } from '../../helpers/classnames';
import { useDialog } from './dialog';
import { Label } from './label';

interface FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  name: TName;
}

interface FormProps<
  TFieldValues extends FieldValues,
  TContext = unknown,
  TTransformedValues extends FieldValues = TFieldValues,
> extends FormProviderProps<TFieldValues, TContext, TTransformedValues> {
  disableBeforeUnload?: boolean;
}

function Form<
  TFieldValues extends FieldValues,
  TContext = unknown,
  TTransformedValues extends FieldValues = TFieldValues,
>(props: FormProps<TFieldValues, TContext, TTransformedValues>) {
  const t = useTranslations('core.global');
  const formIsDirty = props.formState.isDirty;
  useBeforeUnload(
    formIsDirty && !props.disableBeforeUnload,
    t('are_you_sure_want_to_leave_form'),
  );
  const { setIsDirty } = useDialog();

  React.useEffect(() => {
    if (props.disableBeforeUnload) return;

    setIsDirty?.(formIsDirty);
  }, [formIsDirty, props.disableBeforeUnload]);

  return <FormProvider {...props} />;
}

const FormFieldContext = React.createContext<FormFieldContextValue>(
  {} as FormFieldContextValue,
);

const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  ...props
}: ControllerProps<TFieldValues, TName>) => {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
};

const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext);
  const itemContext = React.useContext(FormItemContext);
  const { getFieldState, formState } = useFormContext();

  const fieldState = getFieldState(fieldContext.name, formState);

  if (!fieldContext) {
    throw new Error('useFormField should be used within <FormField>');
  }

  const { id } = itemContext;

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  };
};

interface FormItemContextValue {
  id: string;
}

const FormItemContext = React.createContext<FormItemContextValue>(
  {} as FormItemContextValue,
);

const FormItem = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
  const id = React.useId();

  return (
    <FormItemContext.Provider value={{ id }}>
      <div className={cn('space-y-2', className)} {...props} />
    </FormItemContext.Provider>
  );
};

interface FormLabelProps
  extends React.ComponentProps<typeof LabelPrimitive.Root> {
  optional?: boolean;
}

const FormLabel = ({
  children,
  className,
  optional,
  ...props
}: FormLabelProps) => {
  const { error, formItemId } = useFormField();
  const t = useTranslations('core.global');

  return (
    <Label
      className={cn(
        error && 'text-destructive',
        className,
        'flex flex-wrap gap-2',
      )}
      htmlFor={formItemId}
      {...props}
    >
      <span>{children}</span>
      {optional && (
        <span className="text-muted-foreground text-xs">{t('optional')}</span>
      )}
    </Label>
  );
};

const FormControl = ({ ...props }: React.ComponentProps<typeof Slot>) => {
  const { error, formItemId, formDescriptionId, formMessageId } =
    useFormField();

  return (
    <Slot
      aria-describedby={
        !error ? formDescriptionId : `${formDescriptionId} ${formMessageId}`
      }
      aria-invalid={!!error}
      id={formItemId}
      {...props}
    />
  );
};

const FormDescription = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) => {
  const { formDescriptionId } = useFormField();

  return (
    <p
      className={cn('text-muted-foreground text-sm', className)}
      id={formDescriptionId}
      {...props}
    />
  );
};

const FormMessage = ({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) => {
  const { error, formMessageId } = useFormField();
  const body = error ? String(error.message) : children;

  if (!body) {
    return null;
  }

  return (
    <p
      className={cn('text-destructive text-sm font-medium', className)}
      id={formMessageId}
      {...props}
    >
      {body}
    </p>
  );
};

const FormWrapper = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLFormElement>) => {
  return (
    <form
      className={cn(
        '@container flex flex-col items-start space-y-6 [&>a:last-child]:self-end [&>button:last-child]:self-end',
        className,
      )}
      {...props}
    />
  );
};

const FormFieldRender = ({
  children,
  label,
  optional,
  description,
}: {
  children: React.ReactNode;
  description?: string;
  label: string;
  optional?: boolean;
}) => {
  const t = useTranslations('core.global');

  return (
    <FormItem className="@xs:flex-row @xs:gap-6 flex w-full flex-col">
      <div className="@xs:mt-3 @xs:w-32 @xs:shrink-0 @xs:text-right @sm:w-40 @xl:w-72 @3xl:w-96 @4xl:w-[26rem] flex w-full flex-col gap-1">
        <FormLabel>{label}</FormLabel>
        {optional && (
          <span className="text-muted-foreground text-xs">{t('optional')}</span>
        )}
        {description && <FormDescription>{description}</FormDescription>}
      </div>

      <FormControl>{children}</FormControl>
      <FormMessage />
    </FormItem>
  );
};

export {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormFieldRender,
  FormItem,
  FormLabel,
  FormMessage,
  FormWrapper,
  useFormField,
};
