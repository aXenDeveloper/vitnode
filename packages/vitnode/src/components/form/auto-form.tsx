"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useAnimate, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import {
  type ControllerRenderProps,
  type FieldPath,
  type FieldValues,
  type Mode,
  useForm,
  type UseFormReturn,
} from "react-hook-form";
import z from "zod";

import type { routeMiddlewareSchema } from "../../api/modules/middleware/route";

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
import { Form, FormField } from "../ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

interface ItemAutoFormSharedProps<T extends z.ZodObject<z.ZodRawShape>> {
  hidden?: (values: z.input<T>) => boolean;
  tab?: string;
}

type ItemAutoFormProps<
  T extends z.ZodObject<z.ZodRawShape> = z.ZodObject<z.ZodRawShape>,
  TName extends FieldPath<z.infer<T>> = FieldPath<z.infer<T>>,
> = ItemAutoFormSharedProps<T> &
  (
    | {
        component: (props: ItemAutoFormComponentProps) => React.ReactNode;
        id: TName;
      }
    | {
        component?: never;
        description?: React.ReactNode;
        id: TName;
        label?: React.ReactNode;
      }
  );

export interface AutoFormTab {
  label: React.ReactNode;
  value: string;
}

export interface ItemAutoFormComponentProps {
  description?: React.ReactNode;
  field: ControllerRenderProps<FieldValues, string>;
  itemParams?: InputParams;
  label?: React.ReactNode;
  labelRight?: React.ReactNode;
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

    // Restart the shake on every error, mirroring the macOS shake.
    animate(scope.current, SHAKE_KEYFRAMES, SHAKE_TRANSITION);
  }, [invalid, submitCount, shouldReduceMotion, animate, scope]);

  return <Field data-invalid={invalid} ref={scope} {...props} />;
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
  tabs,
  submitButtonProps,
  children,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  captcha?: z.infer<typeof routeMiddlewareSchema>["captcha"];
  fields: ItemAutoFormProps<T>[];
  formSchema: T;
  mode?: Mode;
  onSubmit?: AutoFormOnSubmit<T, TContext>;
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
  const form = useForm<z.core.input<T>, TContext, z.core.output<T>>({
    resolver: zodResolver(formSchema),
    defaultValues: getDefaults<T>(jsonSchema),
    mode,
  });

  const onSubmit = async (values: z.infer<T>) => {
    const parsedValues = formSchema.safeParse(values);
    if (parsedValues.success) {
      await onSubmitProp?.(parsedValues.data, form, {
        captchaToken: captcha ? await getTokenCaptcha() : "",
      });

      if (captcha) {
        onResetCaptcha();
      }
    }
  };

  const hasConditionalFields = fields.some(
    item => typeof item.hidden === "function",
  );
  // Only subscribe to value changes when a field actually needs them, so forms
  // without conditional fields keep their previous (non re-rendering) behavior.
  // The subscription-driven re-render is intentional here.
  // eslint-disable-next-line react-hooks/incompatible-library
  const watchedValues = hasConditionalFields ? form.watch() : undefined;
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

    return (
      <FormField
        key={item.id}
        name={item.id}
        render={({ field, fieldState }) => {
          return (
            <AutoFormField
              invalid={fieldState.invalid}
              orientation="responsive"
              submitCount={form.formState.submitCount}
            >
              {component({
                field,
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
      disabled={
        !form.formState.isValid ||
        form.formState.isSubmitting ||
        (captcha && !isReady)
      }
      isLoading={form.formState.isSubmitting}
      {...submitButtonProps}
      aria-label={submitButtonProps?.["aria-label"] ?? t("submit")}
      type="submit"
    >
      {submitButtonProps?.children ?? t("submit")}
    </Button>
  );

  return (
    <Form form={form} onSubmit={onSubmit} {...props}>
      {tabs?.length ? (
        <Tabs defaultValue={tabs[0].value}>
          <TabsList>
            {tabs.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {tabs.map(tab => (
            <TabsContent
              className="mt-0 space-y-6"
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
