import {
  type FormApi,
  type FormAsyncValidateOrFn,
  type FormValidateOrFn,
  type StandardSchemaV1,
  useForm,
  useSelector,
} from "@tanstack/react-form";
import { useAnimate, useReducedMotion } from "motion/react";
import { useEffect } from "react";
import { useTranslations } from "use-intl";
import z from "zod";

import type { routeMiddlewareSchema } from "../../api/modules/middleware/route";
import type { AnyFormFieldApi, FormMode, FormSubmitMeta } from "../ui/form";

import { useCaptcha } from "../../hooks/use-captcha";
import {
  getDefaults,
  getNestedParam,
  getZodInputParams,
  type InputParams,
} from "../../lib/helpers/auto-form";
import { SHAKE_KEYFRAMES, SHAKE_TRANSITION } from "../../lib/motion";
import { Button } from "../ui/button";
import { DialogClose, DialogFooter, useDialog } from "../ui/dialog";
import { Field } from "../ui/field";
import { Form, FormField, useFormApi } from "../ui/form";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsPanels,
  TabsTrigger,
} from "../ui/tabs";

export type { AnyFormFieldApi, FormFieldApi } from "../ui/form";
export { setFormFieldError } from "../ui/form";

interface ItemAutoFormSharedProps<T extends z.ZodObject<z.ZodRawShape>> {
  children?: ItemAutoFormProps<T>[];
  hidden?: (values: z.input<T>) => boolean;
  tab?: string;
}

type ItemAutoFormProps<
  T extends z.ZodObject<z.ZodRawShape> = z.ZodObject<z.ZodRawShape>,
> = ItemAutoFormSharedProps<T> &
  (
    | {
        component: (props: ItemAutoFormComponentProps) => React.ReactNode;
        id: string;
      }
    | {
        component?: never;
        description?: React.ReactNode;
        id: string;
        label?: React.ReactNode;
      }
  );

export interface AutoFormTab {
  label: React.ReactNode;
  value: string;
}

export interface ItemAutoFormComponentProps {
  children?: React.ReactNode;
  description?: React.ReactNode;
  field: AnyFormFieldApi;
  itemParams?: InputParams;
  label?: React.ReactNode;
  labelRight?: React.ReactNode;
  multiLang?: boolean;
  otherProps: {
    ["aria-invalid"]?: boolean;
    enum?: string[];
    isOptional?: boolean;
    maxItems?: number;
    maxLength?: number;
    minItems?: number;
    minLength?: number;
    pattern?: string;
    type?: string;
  };
}

type AutoFormValidator<T extends z.ZodObject<z.ZodRawShape>> = StandardSchemaV1<
  z.input<T>,
  z.output<T>
>;

export type AutoFormApi<T extends z.ZodObject<z.ZodRawShape>> = FormApi<
  z.input<T>,
  AutoFormValidator<T>,
  AutoFormValidator<T>,
  FormAsyncValidateOrFn<z.input<T>> | undefined,
  FormValidateOrFn<z.input<T>> | undefined,
  FormAsyncValidateOrFn<z.input<T>> | undefined,
  AutoFormValidator<T>,
  FormAsyncValidateOrFn<z.input<T>> | undefined,
  FormValidateOrFn<z.input<T>> | undefined,
  FormAsyncValidateOrFn<z.input<T>> | undefined,
  FormAsyncValidateOrFn<z.input<T>> | undefined,
  FormSubmitMeta
>;

const usesFormValues = <T extends z.ZodObject<z.ZodRawShape>>(
  item: ItemAutoFormProps<T>,
): boolean =>
  typeof item.hidden === "function" ||
  (item.children?.some(child => usesFormValues(child)) ?? false);

function AutoFormField({
  invalid,
  submitCount,
  ...props
}: React.ComponentProps<typeof Field> & {
  invalid: boolean;
  submitCount: number;
}) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-event-handler
    if (!invalid || shouldReduceMotion || !scope.current) return;

    animate(scope.current, SHAKE_KEYFRAMES, SHAKE_TRANSITION);
  }, [invalid, submitCount, shouldReduceMotion, animate, scope]);

  return <Field data-invalid={invalid} ref={scope} {...props} />;
}

export const AutoFormSubmitButton = ({
  children,
  className,
  intent,
  variant,
}: {
  children?: React.ReactNode;
  className?: string;
  intent?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
}) => {
  const t = useTranslations("core.global");
  const { form } = useFormApi();
  const canSubmit = useSelector(form.store, state => state.canSubmit);
  const isSubmitting = useSelector(form.store, state => state.isSubmitting);

  return (
    <Button
      className={className}
      disabled={!canSubmit}
      isLoading={isSubmitting}
      type="submit"
      value={intent}
      variant={variant}
    >
      {children ?? t("submit")}
    </Button>
  );
};

export type AutoFormOnSubmit<T extends z.ZodObject<z.ZodRawShape>> = (
  values: z.infer<T>,
  form: AutoFormApi<T>,
  options: {
    captchaToken: string;
    intent?: string;
  },
) => Promise<void> | void;

const emptySubmitMeta: FormSubmitMeta = {};

export function AutoForm<T extends z.ZodObject<z.ZodRawShape>>({
  formSchema,
  mode,
  onSubmit: onSubmitProp,
  captcha,
  fields,
  layout,
  tabs,
  submitButtonProps,
  children,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  captcha?: z.infer<typeof routeMiddlewareSchema>["captcha"];
  fields: ItemAutoFormProps<T>[];
  formSchema: T;
  layout?: (renderedFields: Record<string, React.ReactNode>) => React.ReactNode;
  mode?: FormMode;
  onSubmit?: AutoFormOnSubmit<T>;
  submitButtonProps?: Omit<
    React.ComponentProps<typeof Button>,
    "isLoading" | "type"
  >;
  tabs?: AutoFormTab[];
}) {
  const {
    isReady,
    getToken: getTokenCaptcha,
    onReset: onResetCaptcha,
  } = useCaptcha(captcha);
  const { setIsDirty } = useDialog();
  const t = useTranslations("core.global");
  const jsonSchema: z.core.JSONSchema.JSONSchema = z.toJSONSchema(formSchema);
  const inputParams = getZodInputParams(jsonSchema);
  const validator: AutoFormValidator<T> = formSchema;
  const form = useForm({
    defaultValues: getDefaults<T>(jsonSchema),
    onSubmit: async ({ formApi, meta, value }) => {
      const parsedValues = formSchema.safeParse(value);
      if (!parsedValues.success) return;

      await onSubmitProp?.(parsedValues.data, formApi, {
        captchaToken: captcha ? await getTokenCaptcha() : "",
        intent: meta.intent,
      });

      if (captcha) {
        onResetCaptcha();
      }
    },
    onSubmitMeta: emptySubmitMeta,
    validators: {
      onChange: validator,
      onMount: validator,
      onSubmit: validator,
    },
  });

  const hasConditionalFields = fields.some(item => usesFormValues(item));
  const watchedValues = useSelector(form.store, state =>
    hasConditionalFields ? state.values : undefined,
  );
  const submitCount = useSelector(
    form.store,
    state => state.submissionAttempts,
  );
  const canSubmit = useSelector(form.store, state => state.canSubmit);
  const isSubmitting = useSelector(form.store, state => state.isSubmitting);

  const isFieldVisible = (item: ItemAutoFormProps<T>) => {
    if (!item.hidden || !watchedValues) return true;

    return !item.hidden(watchedValues);
  };

  const renderField = (item: ItemAutoFormProps<T>) => {
    const params = getNestedParam(inputParams, item.id);
    if (!params) return null;

    if (!item.component && (item.label || item.description)) {
      return (
        <div key={item.id}>
          {!!item.label && (
            <span className="text-xl leading-none font-semibold tracking-tight">
              {item.label}
            </span>
          )}
          {!!item.description && (
            <div className="text-muted-foreground text-sm">
              {item.description}
            </div>
          )}
        </div>
      );
    }

    if (!item.component) return null;
    const { component } = item;
    const nestedFields = item.children?.filter(isFieldVisible) ?? [];

    return (
      <FormField
        key={item.id}
        name={item.id}
        render={({ field, fieldState }) => {
          return (
            <AutoFormField
              invalid={fieldState.invalid}
              orientation="responsive"
              submitCount={submitCount}
            >
              {component({
                field,
                children: nestedFields.length
                  ? nestedFields.map(renderField)
                  : undefined,
                description:
                  typeof params.description === "string"
                    ? params.description
                    : "",
                itemParams:
                  "itemParams" in params
                    ? (params.itemParams as InputParams)
                    : undefined,
                otherProps: {
                  isOptional: !params.required,
                  enum: Array.isArray(params.enum) ? params.enum : undefined,
                  maxLength:
                    typeof params.maxLength === "number"
                      ? params.maxLength
                      : undefined,
                  maxItems:
                    typeof params.maxItems === "number"
                      ? params.maxItems
                      : undefined,
                  minLength:
                    typeof params.minLength === "number"
                      ? params.minLength
                      : undefined,
                  ["aria-invalid"]: fieldState.invalid,
                  minItems:
                    typeof params.minItems === "number"
                      ? params.minItems
                      : undefined,
                  pattern:
                    typeof params.pattern === "string"
                      ? params.pattern
                      : undefined,
                  type:
                    typeof params.type === "string" ? params.type : undefined,
                },
              })}
            </AutoFormField>
          );
        }}
      />
    );
  };

  const submitButton = (
    <Button
      disabled={!canSubmit || (captcha && !isReady)}
      isLoading={isSubmitting}
      {...submitButtonProps}
      aria-label={submitButtonProps?.["aria-label"] ?? t("submit")}
      type="submit"
    >
      {submitButtonProps?.children ?? t("submit")}
    </Button>
  );

  if (layout) {
    return (
      <Form form={form} mode={mode} {...props}>
        {layout(
          Object.fromEntries(
            fields
              .filter(isFieldVisible)
              .map(item => [item.id, renderField(item)]),
          ),
        )}

        {children}

        {captcha && <div id="vitnode_captcha" />}
      </Form>
    );
  }

  return (
    <Form form={form} mode={mode} {...props}>
      {tabs?.length ? (
        <Tabs defaultValue={tabs[0].value}>
          <TabsList>
            {tabs.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsPanels>
            {tabs.map(tab => (
              <TabsContent
                className="flex flex-col gap-6"
                keepMounted
                key={tab.value}
                value={tab.value}
              >
                {fields
                  .filter(item => (item.tab ?? tabs[0].value) === tab.value)
                  .filter(isFieldVisible)
                  .map(renderField)}
              </TabsContent>
            ))}
          </TabsPanels>
        </Tabs>
      ) : (
        fields.filter(isFieldVisible).map(renderField)
      )}

      {children}

      {captcha && <div id="vitnode_captcha" />}
      {setIsDirty ? (
        <DialogFooter>
          <DialogClose
            render={<Button variant="ghost">{t("cancel")}</Button>}
          />
          {submitButton}
        </DialogFooter>
      ) : (
        submitButton
      )}
    </Form>
  );
}
