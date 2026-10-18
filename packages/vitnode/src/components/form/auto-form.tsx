import {
  type FormApi,
  type FormAsyncValidateOrFn,
  type FormValidateOrFn,
  type StandardSchemaV1,
  useForm,
  useSelector,
} from "@tanstack/react-form";
import { useMemo, useRef, useState } from "react";
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
  isRequiredPath,
} from "../../lib/helpers/auto-form";
import { Button } from "../ui/button";
import { DialogClose, DialogFooter, useDialog } from "../ui/dialog";
import { Field } from "../ui/field";
import {
  areFieldErrorsRevealed,
  Form,
  FormField,
  useFormApi,
} from "../ui/form";
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
    clearsToEmpty?: boolean;
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

// Joined into a string so the form re-renders only when visibility flips,
// not on every keystroke.
const hiddenIdsOf = <T extends z.ZodObject<z.ZodRawShape>>(
  items: ItemAutoFormProps<T>[],
  values: z.input<T>,
): string =>
  items
    .flatMap(item => {
      if (item.hidden?.(values)) return [item.id];
      const nested = item.children ? hiddenIdsOf(item.children, values) : "";

      return nested ? [nested] : [];
    })
    .join("\n");

export const AutoFormFieldSlot = ({
  component,
  ...props
}: ItemAutoFormComponentProps & {
  component: (props: ItemAutoFormComponentProps) => React.ReactNode;
}) => <>{component(props)}</>;

const INVALID_FIELD_SELECTOR = "[data-slot=field][data-invalid=true]";
const FOCUSABLE_SELECTOR =
  "input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [contenteditable=true], [tabindex]:not([tabindex='-1'])";

const outermostInvalidFields = (root: HTMLElement): HTMLElement[] =>
  [...root.querySelectorAll<HTMLElement>(INVALID_FIELD_SELECTOR)].filter(
    element => !element.parentElement?.closest(INVALID_FIELD_SELECTOR),
  );

const focusTargetOf = (fieldElement: HTMLElement): HTMLElement | null =>
  fieldElement.querySelector<HTMLElement>(
    `[aria-invalid=true]:is(${FOCUSABLE_SELECTOR})`,
  ) ?? fieldElement.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);

// Mirrors SHAKE_KEYFRAMES in lib/motion, run through WAAPI so the form does
// not pull motion's animation engine into every bundle that renders it.
const SHAKE_FRAMES: Keyframe[] = [0, -8, 8, -6, 6, -3, 3, 0].map(x => ({
  easing: "ease-in-out",
  transform: `translateX(${x}px)`,
}));
const SHAKE_DURATION_MS = 400;

const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const belongsToField = (fieldName: string, itemId: string) =>
  fieldName === itemId ||
  fieldName.startsWith(`${itemId}.`) ||
  fieldName.startsWith(`${itemId}[`);

type SubmitButtonProps =
  React.ComponentProps<typeof Button> extends infer Props
    ? Props extends unknown
      ? Omit<Props, "isLoading" | "type">
      : never
    : never;

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
  const isSubmitting = useSelector(form.store, state => state.isSubmitting);

  return (
    <Button
      className={className}
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

const revealInvalidFields = (
  root: HTMLFormElement | null,
  onRevealTab: (tab: string) => void,
) => {
  if (!root) return;

  const invalidFields = outermostInvalidFields(root);
  const [firstInvalidField] = invalidFields;
  if (!firstInvalidField) return;

  const tabOfField = firstInvalidField.closest<HTMLElement>(
    "[data-autoform-tab]",
  )?.dataset.autoformTab;
  if (tabOfField) onRevealTab(tabOfField);

  requestAnimationFrame(() => {
    focusTargetOf(firstInvalidField)?.focus();
  });

  if (prefersReducedMotion()) return;
  for (const field of invalidFields) {
    field.animate(SHAKE_FRAMES, SHAKE_DURATION_MS);
  }
};

const invalidTabsOf = <T extends z.ZodObject<z.ZodRawShape>>({
  fields,
  formMode,
  state,
  tabs,
}: {
  fields: ItemAutoFormProps<T>[];
  formMode: FormMode;
  state: { fieldMeta: object; submissionAttempts: number };
  tabs?: AutoFormTab[];
}) => {
  if (!tabs?.length) return "";

  const invalidNames = (
    Object.entries(state.fieldMeta) as [
      string,
      Parameters<typeof areFieldErrorsRevealed>[1],
    ][]
  )
    .filter(
      ([, meta]) =>
        meta.errors.length > 0 &&
        areFieldErrorsRevealed(formMode, meta, state.submissionAttempts),
    )
    .map(([name]) => name);

  return tabs
    .filter(tab =>
      fields.some(
        item =>
          (item.tab ?? tabs[0].value) === tab.value &&
          invalidNames.some(name => belongsToField(name, item.id)),
      ),
    )
    .map(tab => tab.value)
    .join("\n");
};

const numberOrUndefined = (value: unknown) =>
  typeof value === "number" ? value : undefined;

const stringOrUndefined = (value: unknown) =>
  typeof value === "string" ? value : undefined;

const fieldOtherProps = ({
  invalid,
  isOptional,
  params,
}: {
  invalid: boolean;
  isOptional: boolean;
  params: NonNullable<ReturnType<typeof getNestedParam>>;
}) => ({
  isOptional,
  enum: Array.isArray(params.enum) ? params.enum : undefined,
  maxLength: numberOrUndefined(params.maxLength),
  maxItems: numberOrUndefined(params.maxItems),
  minLength: numberOrUndefined(params.minLength),
  ["aria-invalid"]: invalid,
  minItems: numberOrUndefined(params.minItems),
  pattern: stringOrUndefined(params.pattern),
  type: stringOrUndefined(params.type),
});

const emptySubmitMeta: FormSubmitMeta = {};

export function AutoForm<T extends z.ZodObject<z.ZodRawShape>>({
  formSchema,
  mode,
  canSubmitWhenInvalid,
  onSubmit: onSubmitProp,
  captcha,
  fields,
  layout,
  tabs,
  submitButtonProps,
  children,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  canSubmitWhenInvalid?: boolean;
  captcha?: z.infer<typeof routeMiddlewareSchema>["captcha"];
  fields: ItemAutoFormProps<T>[];
  formSchema: T;
  layout?: (renderedFields: Record<string, React.ReactNode>) => React.ReactNode;
  mode?: FormMode;
  onSubmit?: AutoFormOnSubmit<T>;
  submitButtonProps?: SubmitButtonProps;
  tabs?: AutoFormTab[];
}) {
  const {
    isReady,
    getToken: getTokenCaptcha,
    onReset: onResetCaptcha,
  } = useCaptcha(captcha);
  const { setIsDirty } = useDialog();
  const t = useTranslations("core.global");
  const formRef = useRef<HTMLFormElement>(null);
  const [activeTab, setActiveTab] = useState(tabs?.[0]?.value);

  const { defaultValues, inputParams, jsonSchema } = useMemo(() => {
    const schema: z.core.JSONSchema.JSONSchema = z.toJSONSchema(formSchema);

    return {
      defaultValues: getDefaults<T>(schema),
      inputParams: getZodInputParams(schema),
      jsonSchema: schema,
    };
  }, [formSchema]);
  const validator: AutoFormValidator<T> = formSchema;
  const form = useForm({
    canSubmitWhenInvalid: canSubmitWhenInvalid ?? true,
    defaultValues,
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
    onSubmitInvalid: () => {
      requestAnimationFrame(() => {
        revealInvalidFields(formRef.current, setActiveTab);
      });
    },
    onSubmitMeta: emptySubmitMeta,
    validators: {
      onChange: validator,
      onMount: validator,
      onSubmit: validator,
    },
  });

  const hasConditionalFields = fields.some(item => usesFormValues(item));
  const hiddenIds = useSelector(form.store, state =>
    hasConditionalFields ? hiddenIdsOf(fields, state.values) : "",
  );
  const hiddenIdSet = new Set(hiddenIds ? hiddenIds.split("\n") : []);
  const formMode = mode ?? "onTouched";
  const invalidTabs = useSelector(form.store, state =>
    invalidTabsOf({ fields, formMode, state, tabs }),
  );
  const invalidTabValues = new Set(invalidTabs.split("\n"));
  const isSubmitting = useSelector(form.store, state => state.isSubmitting);

  const isFieldVisible = (item: ItemAutoFormProps<T>) =>
    !hiddenIdSet.has(item.id);

  const renderField = (item: ItemAutoFormProps<T>) => {
    const params = getNestedParam(inputParams, item.id);
    if (!params) return null;

    if (!item.component && (item.label || item.description)) {
      return (
        <div key={item.id}>
          {!!item.label && (
            <h3 className="text-xl leading-none font-semibold text-balance">
              {item.label}
            </h3>
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
            <Field data-invalid={fieldState.invalid} orientation="responsive">
              <AutoFormFieldSlot
                component={component}
                {...(nestedFields.length
                  ? { children: nestedFields.map(renderField) }
                  : {})}
                description={
                  typeof params.description === "string"
                    ? params.description
                    : ""
                }
                field={field}
                itemParams={
                  "itemParams" in params
                    ? (params.itemParams as InputParams)
                    : undefined
                }
                otherProps={fieldOtherProps({
                  invalid: fieldState.invalid,
                  isOptional: !isRequiredPath(jsonSchema, item.id),
                  params,
                })}
              />
            </Field>
          );
        }}
      />
    );
  };

  const submitButton = (
    <Button
      disabled={!!captcha && !isReady}
      isLoading={isSubmitting}
      {...submitButtonProps}
      type="submit"
    >
      {submitButtonProps?.children ?? t("submit")}
    </Button>
  );

  if (layout) {
    return (
      <Form form={form} mode={formMode} ref={formRef} {...props}>
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
    <Form form={form} mode={formMode} ref={formRef} {...props}>
      {tabs?.length ? (
        <Tabs
          onValueChange={value => {
            setActiveTab(String(value));
          }}
          value={activeTab ?? tabs[0].value}
        >
          <TabsList>
            {tabs.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
                {invalidTabValues.has(tab.value) && (
                  <>
                    <span
                      aria-hidden="true"
                      className="bg-destructive size-1.5 shrink-0 rounded-full"
                    />
                    <span className="sr-only">{t("tab_has_errors")}</span>
                  </>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsPanels>
            {tabs.map(tab => (
              <TabsContent
                className="flex flex-col gap-6"
                data-autoform-tab={tab.value}
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
