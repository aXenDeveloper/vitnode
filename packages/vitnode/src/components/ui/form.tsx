import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import {
  type AnyFieldApi,
  type AnyFormApi,
  Field as FormFieldPrimitive,
  useSelector,
} from "@tanstack/react-form";
import { cn } from "cn";
import React from "react";
import { useTranslations } from "use-intl";

import { useBeforeUnload } from "../../hooks/use-before-unload";
import { useDialog } from "./dialog";
import { FieldError } from "./field";

export type FormMode = "all" | "onBlur" | "onChange" | "onSubmit" | "onTouched";

export interface FormSubmitMeta {
  intent?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FormFieldValue = any;

export interface FormFieldApi {
  disabled?: boolean;
  name: string;
  onBlur: () => void;
  onChange: (change: FormFieldValue) => void;
  value: FormFieldValue;
}

export interface FormFieldError {
  message: string;
}

export interface FormFieldState {
  error?: FormFieldError;
  errors: FormFieldError[];
  invalid: boolean;
  isDirty: boolean;
  isTouched: boolean;
}

interface FormContextValue {
  form: AnyFormApi;
  mode: FormMode;
}

const FormContext = React.createContext<FormContextValue | null>(null);

const useFormApi = () => {
  const context = React.use(FormContext);

  if (!context) {
    throw new Error("useFormApi should be used within <Form>");
  }

  return context;
};

const valueOfChange = (change: FormFieldValue): FormFieldValue => {
  if (change === null || typeof change !== "object" || !("target" in change)) {
    return change;
  }

  const { target } = change as { target: HTMLInputElement };

  return target.type === "checkbox" ? target.checked : target.value;
};

const toFormFieldApi = (field: AnyFieldApi): FormFieldApi => ({
  name: field.name,
  onBlur: () => {
    field.handleBlur();
  },
  onChange: change => {
    if (field.state.meta.errorMap.onServer !== undefined) {
      field.setErrorMap({ onServer: undefined });
    }

    field.handleChange(valueOfChange(change));
  },
  value: field.state.value,
});

const toFormFieldError = (error: unknown): FormFieldError | undefined => {
  if (typeof error === "string") {
    return { message: error };
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return { message: error.message };
  }

  return undefined;
};

const areErrorsRevealed = (
  mode: FormMode,
  meta: AnyFieldApi["state"]["meta"],
  submissionAttempts: number,
): boolean => {
  if (submissionAttempts > 0) {
    return true;
  }

  if (mode === "all" || mode === "onChange") {
    return meta.isTouched;
  }

  if (mode === "onBlur" || mode === "onTouched") {
    return meta.isBlurred;
  }

  return false;
};

const toFormFieldState = (
  field: AnyFieldApi,
  mode: FormMode,
  submissionAttempts: number,
): FormFieldState => {
  const { meta } = field.state;
  const errors = areErrorsRevealed(mode, meta, submissionAttempts)
    ? meta.errors
        .map(toFormFieldError)
        .filter(error => error !== undefined)
        .filter(
          (error, at, all) =>
            all.findIndex(other => other.message === error.message) === at,
        )
    : [];

  return {
    error: errors[0],
    errors,
    invalid: errors.length > 0,
    isDirty: meta.isDirty,
    isTouched: meta.isTouched,
  };
};

const submitIntentOf = (
  event: React.SyntheticEvent<HTMLFormElement>,
): string | undefined => {
  const native = event.nativeEvent;
  if (!("submitter" in native)) return undefined;

  const { submitter } = native as SubmitEvent;

  return submitter instanceof HTMLButtonElement && submitter.value !== ""
    ? submitter.value
    : undefined;
};

const setFormFieldError = (
  form: AnyFormApi,
  name: string,
  message: string,
  options?: { shouldFocus?: boolean },
) => {
  form.setFieldMeta(name, previous => ({
    ...previous,
    errorMap: { ...previous.errorMap, onServer: [{ message }] },
    errorSourceMap: { ...previous.errorSourceMap, onServer: "field" },
  }));

  if (options?.shouldFocus !== false) {
    document.getElementById(`${name}-form-item`)?.focus();
  }
};

const pushFormFieldValue = (form: AnyFormApi, name: string, value: unknown) => {
  form.pushFieldValue(name as never, value);
};

const removeFormFieldValue = (
  form: AnyFormApi,
  name: string,
  index: number,
) => {
  void form.removeFieldValue(name as never, index);
};

function Form({
  children,
  className,
  disableBeforeUnload,
  form,
  mode = "onSubmit",
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  disableBeforeUnload?: boolean;
  form: AnyFormApi;
  mode?: FormMode;
}) {
  const t = useTranslations("core.global");
  const formIsDirty = useSelector(form.store, state => !state.isDefaultValue);
  useBeforeUnload(
    formIsDirty && !disableBeforeUnload,
    `${t("are_you_sure_want_to_leave_form.title")} ${t("are_you_sure_want_to_leave_form.desc")}`,
  );
  const { setIsDirty } = useDialog();
  const context = React.useMemo(() => ({ form, mode }), [form, mode]);

  React.useEffect(() => {
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-event-handler
    if (disableBeforeUnload) return;

    setIsDirty?.(formIsDirty);
  }, [formIsDirty, disableBeforeUnload, setIsDirty]);

  return (
    <FormContext value={context}>
      <form
        className={cn("space-y-8", className)}
        onSubmit={event => {
          event.preventDefault();
          event.stopPropagation();

          const meta: FormSubmitMeta = { intent: submitIntentOf(event) };
          void form.handleSubmit(meta);
        }}
        {...props}
      >
        {children}
      </form>
    </FormContext>
  );
}

type FormFieldContextValue = FormFieldState & { name: string };

const FormFieldContext = React.createContext<FormFieldContextValue | null>(
  null,
);

const FormField = ({
  name,
  render,
}: {
  name: string;
  render: (props: {
    field: FormFieldApi;
    fieldState: FormFieldState;
  }) => React.ReactNode;
}) => {
  const { form, mode } = useFormApi();
  const submissionAttempts = useSelector(
    form.store,
    state => state.submissionAttempts,
  );

  return (
    <FormFieldPrimitive form={form} name={name}>
      {field => {
        const fieldState = toFormFieldState(field, mode, submissionAttempts);

        return (
          <FormFieldContext value={{ name, ...fieldState }}>
            {render({ field: toFormFieldApi(field), fieldState })}
          </FormFieldContext>
        );
      }}
    </FormFieldPrimitive>
  );
};

const useFormField = () => {
  const fieldContext = React.use(FormFieldContext);

  if (!fieldContext) {
    throw new Error("useFormField should be used within <FormField>");
  }

  const id = fieldContext.name;

  return {
    id,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldContext,
  };
};

function FormControl({ children, ...props }: React.ComponentProps<"div">) {
  const { error, formItemId, formDescriptionId, formMessageId } =
    useFormField();

  return useRender({
    props: mergeProps<"div">(
      {
        "aria-describedby": error
          ? `${formDescriptionId} ${formMessageId}`
          : formDescriptionId,
        "aria-invalid": !!error,
        id: formItemId,
      },
      props,
    ),
    render: children as React.ReactElement,
  });
}

function FormMessage(props: React.ComponentProps<typeof FieldError>) {
  const { errors } = useFormField();

  if (!errors.length) {
    return null;
  }

  return <FieldError errors={errors} {...props} />;
}

export {
  Form,
  FormControl,
  FormField,
  FormMessage,
  pushFormFieldValue,
  removeFormFieldValue,
  setFormFieldError,
  useFormApi,
  useFormField,
};
