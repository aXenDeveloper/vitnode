"use client";

import { useTranslations } from "next-intl";
import { Slot } from "radix-ui";
import React from "react";
import {
  Controller,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
  FormProvider,
  type SubmitHandler,
  useFormContext,
  useFormState,
} from "react-hook-form";

import { cn } from "@/lib/utils";

import { useBeforeUnload } from "../../hooks/use-before-unload";
import { Button } from "./button";
import { useDialog } from "./dialog";
import { FieldError } from "./field";

function Form<
  TFieldValues extends FieldValues,
  TContext = unknown,
  TTransformedValues extends FieldValues | undefined = undefined,
>({
  children,
  form,
  className,
  onSubmit,
  disableBeforeUnload,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  disableBeforeUnload?: boolean;
  form: Omit<
    React.ComponentProps<
      typeof FormProvider<TFieldValues, TContext, TTransformedValues>
    >,
    "children"
  >;
  onSubmit: SubmitHandler<TTransformedValues>;
}) {
  const t = useTranslations("core.global");
  const formIsDirty = form.formState.isDirty;
  useBeforeUnload(
    formIsDirty && !disableBeforeUnload,
    `${t("are_you_sure_want_to_leave_form.title")} ${t("are_you_sure_want_to_leave_form.desc")}`,
  );
  const { setIsDirty } = useDialog();

  React.useEffect(() => {
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-event-handler
    if (disableBeforeUnload) return;

    setIsDirty?.(formIsDirty);
  }, [formIsDirty, disableBeforeUnload, setIsDirty]);

  return (
    <FormProvider {...form}>
      <form
        className={cn("space-y-8", className)}
        onSubmit={form.handleSubmit(onSubmit)}
        {...props}
      >
        {children}
      </form>
    </FormProvider>
  );
}

interface FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  name: TName;
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
  const contextValue = React.useMemo(
    () => ({ name: props.name }),
    [props.name],
  );

  return (
    <FormFieldContext value={contextValue}>
      <Controller {...props} />
    </FormFieldContext>
  );
};

const useFormField = () => {
  const fieldContext = React.use(FormFieldContext);
  const { getFieldState } = useFormContext();
  const formState = useFormState({ name: fieldContext.name });
  const fieldState = getFieldState(fieldContext.name, formState);

  if (!fieldContext) {
    throw new Error("useFormField should be used within <FormField>");
  }

  const id = fieldContext.name;

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  };
};

function FormControl({ ...props }: React.ComponentProps<typeof Slot.Root>) {
  const { error, formItemId, formDescriptionId, formMessageId } =
    useFormField();

  return (
    <Slot.Root
      aria-describedby={
        error ? `${formDescriptionId} ${formMessageId}` : formDescriptionId
      }
      aria-invalid={!!error}
      id={formItemId}
      {...props}
    />
  );
}

function FormDescription({ className, ...props }: React.ComponentProps<"p">) {
  const { formDescriptionId } = useFormField();

  return (
    <p
      className={cn("text-muted-foreground text-sm", className)}
      data-slot="form-description"
      id={formDescriptionId}
      {...props}
    />
  );
}

function FormMessage(props: React.ComponentProps<typeof FieldError>) {
  const { error } = useFormField();

  if (!error) {
    return null;
  }

  return <FieldError errors={[error]} {...props} />;
}

const FormButtonSubmit = ({
  className,
  ...props
}: React.ComponentProps<typeof Button>) => {
  const { formState } = useFormContext();

  return (
    <Button
      className={cn("w-full", className)}
      disabled={!formState.isValid}
      isLoading={formState.isSubmitting}
      type="submit"
      {...props}
    />
  );
};

export {
  Form,
  FormButtonSubmit,
  FormControl,
  FormDescription,
  FormField,
  FormMessage,
  useFormField,
};
