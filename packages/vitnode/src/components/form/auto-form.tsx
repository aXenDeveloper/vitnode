import {
  type FormApi,
  type FormAsyncValidateOrFn,
  type FormValidateOrFn,
  type StandardSchemaV1,
  useForm,
  useSelector,
} from "@tanstack/react-form";
import { animate, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";
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
import { SHAKE_KEYFRAMES, SHAKE_TRANSITION } from "../../lib/motion";
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
  /**
   * Nested fields, rendered and passed to this field's component as
   * `children` - e.g. extra inputs inside a group.
   */
  children?: ItemAutoFormProps<T>[];
  /** Hides the field while it returns `true`; re-evaluated on every change. */
  hidden?: (values: z.input<T>) => boolean;
  /** The `value` of the {@link AutoFormTab} the field shows in. Defaults to the first tab. */
  tab?: string;
}

/**
 * One entry of `AutoForm`'s `fields`. Either a field rendered by `component`,
 * or - without a component - a heading with a `label` and `description`.
 *
 * Either way, `id` must name a key of `formSchema` (a dotted path for a nested
 * object, e.g. `seo.title`); an id the schema does not have renders nothing.
 */
type ItemAutoFormProps<
  T extends z.ZodObject<z.ZodRawShape> = z.ZodObject<z.ZodRawShape>,
> = ItemAutoFormSharedProps<T> &
  (
    | {
        /**
         * Renders the field, usually one of the `AutoForm*` field components
         * from `@vitnode/core/components/form/fields/*` with the props spread
         * in and a `label` added.
         */
        component: (props: ItemAutoFormComponentProps) => React.ReactNode;
        /** The schema key the field edits. */
        id: string;
      }
    | {
        component?: never;
        description?: React.ReactNode;
        id: string;
        label?: React.ReactNode;
      }
  );

/** One tab of a tabbed `AutoForm`. Fields pick a tab with their `tab`. */
export interface AutoFormTab {
  label: React.ReactNode;
  value: string;
}

/**
 * What `AutoForm` passes to a field's `component`. Spread it into an
 * `AutoForm*` field component, or build a custom field on `field`.
 */
export interface ItemAutoFormComponentProps {
  /** The rendered nested fields declared in the item's `children`. */
  children?: React.ReactNode;
  /**
   * Help text under the field. `AutoForm` fills it from the schema's
   * description (`.describe()`); a component may override it.
   */
  description?: React.ReactNode;
  /** The field's value and change/blur handlers, bound to the form. */
  field: AnyFormFieldApi;
  /** Constraints of an array field's items, read from the schema. */
  itemParams?: InputParams;
  /** Not filled by `AutoForm`; pass it to the field component yourself. */
  label?: React.ReactNode;
  /** Content shown at the right end of the label row. */
  labelRight?: React.ReactNode;
  /** Edit one value per enabled language. Supported by `AutoFormInput`, `AutoFormTextarea` and `AutoFormEditor`. */
  multiLang?: boolean;
  /** Constraints `AutoForm` reads from the field's Zod schema. */
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

/**
 * The TanStack Form instance behind an `AutoForm`, as its `onSubmit` receives
 * it - for `form.reset()`, or {@link setFormFieldError} after an API error.
 */
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

/** Renders one field's `component` with its props. Used by `AutoForm` and content form layouts. */
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

/**
 * A submit button for an `AutoForm` with a custom `layout`, which renders no
 * button of its own. Shows a spinner while the form submits.
 *
 * Several buttons with different `intent` values can share one form: the
 * clicked button's intent reaches `onSubmit` as `options.intent`.
 */
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

/**
 * `AutoForm`'s submit handler. Runs only with values that passed the schema,
 * already parsed (Zod output, so transforms and defaults are applied).
 *
 * `options.captchaToken` is a fresh token when the form has `captcha`, `""`
 * otherwise; pass it to the fetcher's `captchaToken`. `options.intent` is the
 * `value` of the submit button that was clicked, if any.
 */
export type AutoFormOnSubmit<T extends z.ZodObject<z.ZodRawShape>> = (
  values: z.infer<T>,
  form: AutoFormApi<T>,
  options: {
    captchaToken: string;
    intent?: string;
  },
) => Promise<void> | void;

const useRevealInvalidFields = (
  formRef: React.RefObject<HTMLFormElement | null>,
  onRevealTab: (tab: string) => void,
) => {
  const shouldReduceMotion = useReducedMotion();

  return () => {
    const root = formRef.current;
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

    if (shouldReduceMotion) return;
    for (const field of invalidFields) {
      void animate(field, SHAKE_KEYFRAMES, SHAKE_TRANSITION);
    }
  };
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

/**
 * A form generated from a Zod object schema: validation, default values,
 * required markers, length limits and error display all come from the schema,
 * and `fields` only says which component renders each key. The form to use for
 * any form in VitNode and its plugins.
 *
 * - Defaults come from the schema's `.default()` values.
 * - The schema validates on mount, on change and on submit; `mode` only decides
 *   when errors become visible. A failed submit reveals every error, switches
 *   to the first tab with one, focuses it and shakes the invalid fields.
 * - Inside a `Dialog` it renders a footer with Cancel and Submit, and the dialog
 *   asks before closing with unsaved changes. Leaving the page with unsaved
 *   changes asks too.
 * - With `layout`, no submit button is rendered: add `AutoFormSubmitButton`, or
 *   `AutoFormSheetFooter` in a sheet.
 *
 * Browser-only interaction, but safe to render during SSR.
 *
 * @example
 * ```tsx
 * import { AutoForm } from "@vitnode/core/components/form/auto-form";
 * import { AutoFormInput } from "@vitnode/core/components/form/fields/input";
 * import { z } from "zod";
 *
 * const formSchema = z.object({ title: z.string().min(3).max(100) });
 *
 * export const TitleForm = () => (
 *   <AutoForm
 *     fields={[
 *       {
 *         id: "title",
 *         component: props => <AutoFormInput {...props} label="Title" />,
 *       },
 *     ]}
 *     formSchema={formSchema}
 *     onSubmit={async values => {
 *       // values.title is a string of 3-100 characters
 *     }}
 *   />
 * );
 * ```
 */
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
  /**
   * Lets a submit with invalid values start, so the invalid fields are
   * revealed and focused; `onSubmit` still never runs with them. Defaults to
   * `true`.
   */
  canSubmitWhenInvalid?: boolean;
  /**
   * The app's captcha config, from the middleware API. When set, the submit
   * button waits for the captcha to load and `onSubmit` gets a token.
   */
  captcha?: z.infer<typeof routeMiddlewareSchema>["captcha"];
  /** Which component renders each schema key, in display order. */
  fields: ItemAutoFormProps<T>[];
  /** Validates the values, and supplies defaults and field constraints. */
  formSchema: T;
  /**
   * Places the rendered fields yourself; receives them keyed by `id`. Replaces
   * the tabs and the built-in submit button.
   */
  layout?: (renderedFields: Record<string, React.ReactNode>) => React.ReactNode;
  /**
   * When a field's errors become visible: after blur (`onTouched`, `onBlur`),
   * after the first change (`onChange`, `all`) or only after a submit
   * (`onSubmit`). Every error shows after a submit. Defaults to `onTouched`.
   */
  mode?: FormMode;
  onSubmit?: AutoFormOnSubmit<T>;
  /** Props of the built-in submit button; `children` replaces its label. */
  submitButtonProps?: SubmitButtonProps;
  /** Splits the fields into tabs; a tab with an error is marked. */
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
  const revealInvalidFields = useRevealInvalidFields(formRef, setActiveTab);

  const jsonSchema: z.core.JSONSchema.JSONSchema = z.toJSONSchema(formSchema);
  const inputParams = getZodInputParams(jsonSchema);
  const validator: AutoFormValidator<T> = formSchema;
  const form = useForm({
    canSubmitWhenInvalid: canSubmitWhenInvalid ?? true,
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
    onSubmitInvalid: () => {
      requestAnimationFrame(revealInvalidFields);
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
  const formMode = mode ?? "onTouched";
  const invalidTabs = useSelector(form.store, state =>
    invalidTabsOf({ fields, formMode, state, tabs }),
  );
  const invalidTabValues = new Set(invalidTabs.split("\n"));
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
