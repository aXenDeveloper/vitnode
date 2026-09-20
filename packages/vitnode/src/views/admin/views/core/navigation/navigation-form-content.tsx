import { toast } from "sonner";
import { useLocale, useTranslations } from "use-intl";
import { z } from "zod";

import type { ItemAutoFormComponentProps } from "@/components/form/auto-form";
import type { MultiLangValue } from "@/lib/helpers/multi-lang";
import type {
  NavigationKind,
  NavigationPreset,
  NavigationText,
} from "@/lib/navigation";
import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";

import {
  AutoForm,
  type AutoFormOnSubmit,
  setFormFieldError,
} from "@/components/form/auto-form";
import { AutoFormLabel } from "@/components/form/common/label";
import { AutoFormEmojiIcon } from "@/components/form/fields/emoji-icon";
import { AutoFormInput } from "@/components/form/fields/input";
import { AutoFormRadioGroup } from "@/components/form/fields/radio-group";
import { AutoFormSwitch } from "@/components/form/fields/switch";
import { AutoFormTextarea } from "@/components/form/fields/textarea";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { useDialog } from "@/components/ui/dialog";
import { EmojiIcon } from "@/components/ui/emoji-icon";
import { FormControl, FormMessage, useFormApi } from "@/components/ui/form";
import { EMOJI_ICON_MAX_LENGTH, parseEmojiIcon } from "@/lib/emoji-icon";
import { multiLangValueSchema } from "@/lib/helpers/multi-lang";
import {
  isValidNavigationHref,
  NAVIGATION_DESCRIPTION_MAX_LENGTH,
  NAVIGATION_HREF_MAX_LENGTH,
  NAVIGATION_KINDS,
  NAVIGATION_TITLE_MAX_LENGTH,
  navigationItemLabels,
  navigationPresetKey,
  parseNavigationPresetKey,
} from "@/lib/navigation";

import type { AdminNavigationItem } from "./navigation-query";

import {
  autofillNavigationIcon,
  autofillNavigationText,
  prefillNavigationText,
  stripDefaultNavigationText,
} from "./navigation-form-texts";
import { presetLabelSource, useNavigationTranslate } from "./navigation-labels";

export interface AdminNavigationFormValues {
  description: MultiLangValue;
  href: string;
  icon: string;
  isOpenInNewTab: boolean;
  kind: NavigationKind;
  preset: string;
  title: MultiLangValue;
}

export interface AdminNavigationFormProps {
  data?: AdminNavigationItem;
  onSave: (args: {
    id?: number;
    values: AdminNavigationFormValues;
  }) => Promise<AdminMutationResult<unknown>>;
  onSaved?: (name: string) => void;
  presets: NavigationPreset[];
  usedPresetKeys: string[];
}

/** A menu item wears an icon, never an emoji. */
const ICON_ONLY = ["icon"] as const;

const hasText = (values: readonly NavigationText[]): boolean =>
  values.some(item => item.value.trim().length > 0);

const presetOf = (
  presets: readonly NavigationPreset[],
  key: string,
): NavigationPreset | undefined => {
  const parsed = parseNavigationPresetKey(key);

  return parsed
    ? presets.find(
        preset =>
          preset.pluginId === parsed.pluginId && preset.id === parsed.presetId,
      )
    : undefined;
};

/** The page a prebuilt item points at, which an edit cannot change. */
const NavigationPresetSummary = ({
  preset,
}: {
  preset: NavigationPreset | undefined;
}) => {
  const t = useTranslations("admin.navigation.form");
  const locale = useLocale();
  const translate = useNavigationTranslate();

  if (!preset) return null;

  const { title } = navigationItemLabels({
    item: presetLabelSource(preset),
    locale,
    translate,
  });

  return (
    <>
      <AutoFormLabel>{t("preset")}</AutoFormLabel>

      <div className="bg-muted/40 flex min-w-0 items-center gap-3 rounded-md border px-3 py-2">
        <EmojiIcon
          className="text-muted-foreground size-4.5 shrink-0"
          value={parseEmojiIcon(preset.icon)}
        />

        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">
            {title || preset.id}
          </span>
          <span className="text-muted-foreground truncate font-mono text-xs">
            {preset.href}
          </span>
        </div>

        <span className="text-muted-foreground ms-auto shrink-0 text-xs">
          {preset.pluginId}
        </span>
      </div>

      <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
        {t("presetLocked")}
      </p>
    </>
  );
};

/** One prebuilt page, as the picker lists it. */
interface NavigationPresetOption {
  icon: null | string;
  label: string;
  pluginId: string;
  value: string;
}

const matchesPresetSearch = (
  option: NavigationPresetOption,
  query: string,
): boolean => {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = `${option.label} ${option.pluginId}`.toLowerCase();

  return terms.every(term => haystack.includes(term));
};

const NavigationPresetField = ({
  presets,
  usedPresetKeys,
  ...props
}: ItemAutoFormComponentProps & {
  presets: NavigationPreset[];
  usedPresetKeys: string[];
}) => {
  const t = useTranslations("admin.navigation.form");
  const tGlobal = useTranslations("core.global");
  const locale = useLocale();
  const translate = useNavigationTranslate();
  const { form } = useFormApi();
  const { field, otherProps } = props;

  const labelsOf = (preset: NavigationPreset) =>
    navigationItemLabels({
      item: presetLabelSource(preset),
      locale,
      translate,
    });

  const options: NavigationPresetOption[] = presets
    .map(preset => ({
      icon: preset.icon,
      label: labelsOf(preset).title || preset.id,
      pluginId: preset.pluginId,
      value: navigationPresetKey(preset.pluginId, preset.id),
    }))
    .filter(option => !usedPresetKeys.includes(option.value));

  const selected = options.find(option => option.value === field.value) ?? null;

  /** Picking a page names the item, unless the admin already named it. */
  const onSelect = (option: NavigationPresetOption | null) => {
    const previous = presetOf(presets, String(field.value ?? ""));
    const next = option ? presetOf(presets, option.value) : undefined;

    field.onChange(option?.value ?? "");

    const values = form.state.values as AdminNavigationFormValues;
    const previousLabels = previous ? labelsOf(previous) : undefined;
    const nextLabels = next ? labelsOf(next) : undefined;

    const title = autofillNavigationText({
      locale,
      nextFallback: nextLabels?.title,
      previousFallback: previousLabels?.title,
      values: values.title,
    });
    if (title) form.setFieldValue("title", title);

    const description = autofillNavigationText({
      locale,
      nextFallback: nextLabels?.description,
      previousFallback: previousLabels?.description,
      values: values.description,
    });
    if (description) form.setFieldValue("description", description);

    const icon = autofillNavigationIcon({
      icon: values.icon,
      nextIcon: next?.icon,
      previousIcon: previous?.icon,
    });
    if (icon !== undefined) form.setFieldValue("icon", icon);
  };

  return (
    <>
      <AutoFormLabel isOptional={otherProps.isOptional}>
        {t("preset")}
      </AutoFormLabel>

      {options.length === 0 ? (
        <p className="text-muted-foreground text-sm leading-relaxed">
          {t("presetEmpty")}
        </p>
      ) : (
        <FormControl>
          <Combobox
            autoHighlight
            filter={matchesPresetSearch}
            items={options}
            onValueChange={onSelect}
            value={selected}
          >
            <ComboboxInput
              aria-invalid={otherProps["aria-invalid"] ?? false}
              onBlur={field.onBlur}
              placeholder={t("presetPlaceholder")}
            />

            <ComboboxContent>
              <ComboboxEmpty>{tGlobal("results_not_found")}</ComboboxEmpty>

              <ComboboxList>
                {(option: NavigationPresetOption) => (
                  <ComboboxItem key={option.value} value={option}>
                    <span className="flex min-w-0 items-center gap-2">
                      <EmojiIcon
                        className="text-muted-foreground size-4 shrink-0"
                        value={parseEmojiIcon(option.icon)}
                      />
                      <span className="truncate">{option.label}</span>
                      <span className="text-muted-foreground truncate text-xs">
                        {option.pluginId}
                      </span>
                    </span>
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </FormControl>
      )}

      <FormMessage />
    </>
  );
};

export const AdminNavigationFormContent = ({
  data,
  onSave,
  onSaved,
  presets,
  usedPresetKeys,
}: AdminNavigationFormProps) => {
  const t = useTranslations("admin.navigation");
  const tCore = useTranslations("core.global.errors");
  const locale = useLocale();
  const translate = useNavigationTranslate();
  const { setIsDirty, setOpen } = useDialog();

  const isEdit = data !== undefined;
  const currentPresetKey =
    data?.kind === "preset" && data.pluginId && data.presetId
      ? navigationPresetKey(data.pluginId, data.presetId)
      : "";
  const currentPreset = presets.find(
    preset =>
      navigationPresetKey(preset.pluginId, preset.id) === currentPresetKey,
  );
  const availablePresets = presets.filter(
    preset =>
      !usedPresetKeys.includes(navigationPresetKey(preset.pluginId, preset.id)),
  );
  const defaultKind: NavigationKind =
    data?.kind ?? (availablePresets.length > 0 ? "preset" : "custom");

  // What this item renders with today, so an edit opens on the live values
  // rather than on empty boxes next to placeholders.
  const currentDefaults = currentPreset
    ? navigationItemLabels({
        item: presetLabelSource(currentPreset),
        locale,
        translate,
      })
    : undefined;

  const formSchema = z.object({
    kind: z.enum(NAVIGATION_KINDS).default(defaultKind),
    preset: z.string().default(currentPresetKey),
    href: z
      .string()
      .max(NAVIGATION_HREF_MAX_LENGTH)
      .refine(value => value === "" || isValidNavigationHref(value), {
        message: t("errors.hrefInvalid"),
      })
      .default(data?.href ?? ""),
    icon: z
      .string()
      .max(EMOJI_ICON_MAX_LENGTH)
      .default(data?.icon ?? currentPreset?.icon ?? ""),
    title: multiLangValueSchema({
      maxLength: NAVIGATION_TITLE_MAX_LENGTH,
    }).default(
      prefillNavigationText({
        fallback: currentDefaults?.title,
        locale,
        stored: data?.title ?? [],
      }),
    ),
    description: multiLangValueSchema({
      maxLength: NAVIGATION_DESCRIPTION_MAX_LENGTH,
    }).default(
      prefillNavigationText({
        fallback: currentDefaults?.description,
        locale,
        stored: data?.description ?? [],
      }),
    ),
    isOpenInNewTab: z.boolean().default(data?.isOpenInNewTab ?? false),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async (
    values,
    form,
  ) => {
    if (values.kind === "preset" && !parseNavigationPresetKey(values.preset)) {
      setFormFieldError(form, "preset", t("errors.presetRequired"));

      return;
    }

    if (values.kind === "custom") {
      if (!isValidNavigationHref(values.href)) {
        setFormFieldError(form, "href", t("errors.hrefInvalid"));

        return;
      }
      if (!hasText(values.title)) {
        setFormFieldError(form, "title", t("errors.titleRequired"));

        return;
      }
    }

    const preset =
      values.kind === "preset" ? presetOf(presets, values.preset) : undefined;
    const defaults = preset
      ? navigationItemLabels({
          item: presetLabelSource(preset),
          locale,
          translate,
        })
      : undefined;

    const result = await onSave({
      id: data?.id,
      values: {
        ...values,
        description: stripDefaultNavigationText({
          fallback: defaults?.description,
          values: values.description,
        }),
        // A prebuilt page's own icon is the default, so leaving it alone must
        // not store a copy that stops following the plugin.
        icon: values.icon === preset?.icon ? "" : values.icon,
        title: stripDefaultNavigationText({
          fallback: defaults?.title,
          values: values.title,
        }),
      },
    });

    if ("error" in result) {
      if (result.error.status === 409) {
        setFormFieldError(form, "preset", t("errors.presetTaken"));

        return;
      }

      toast.error(tCore("title"), {
        description: tCore("internal_server_error"),
      });

      return;
    }

    const name = navigationItemLabels({
      item: {
        description: values.description,
        kind: values.kind,
        pluginId: preset?.pluginId ?? null,
        presetId: preset?.id ?? null,
        title: values.title,
      },
      locale,
      translate,
    }).title;

    toast.success(t(isEdit ? "edit.success" : "create.success"), {
      description: t(isEdit ? "edit.successDesc" : "create.successDesc", {
        name,
      }),
    });
    setIsDirty?.(false);
    setOpen?.(false);
    onSaved?.(name);
  };

  return (
    <AutoForm
      fields={[
        ...(isEdit
          ? []
          : [
              {
                component: (props: ItemAutoFormComponentProps) => (
                  <AutoFormRadioGroup
                    {...props}
                    label={t("form.kind.label")}
                    labels={[
                      {
                        description: t("form.kind.presetDesc"),
                        disabled: availablePresets.length === 0,
                        label: t("form.kind.preset"),
                        value: "preset",
                      },
                      {
                        description: t("form.kind.customDesc"),
                        label: t("form.kind.custom"),
                        value: "custom",
                      },
                    ]}
                    variant="blocks"
                  />
                ),
                id: "kind",
              },
            ]),
        ...(isEdit && data.kind === "preset"
          ? [
              {
                component: () => (
                  <NavigationPresetSummary preset={currentPreset} />
                ),
                id: "preset",
              },
            ]
          : [
              {
                component: (props: ItemAutoFormComponentProps) => (
                  <NavigationPresetField
                    {...props}
                    presets={presets}
                    usedPresetKeys={usedPresetKeys}
                  />
                ),
                hidden: (values: { kind?: NavigationKind }) =>
                  values.kind !== "preset",
                id: "preset",
              },
            ]),
        {
          component: (props: ItemAutoFormComponentProps) => (
            <AutoFormInput
              {...props}
              label={t("form.href")}
              placeholder={t("form.hrefPlaceholder")}
            />
          ),
          hidden: (values: { kind?: NavigationKind }) =>
            values.kind !== "custom",
          id: "href",
        },
        {
          component: (props: ItemAutoFormComponentProps) => (
            <AutoFormInput {...props} label={t("form.title")} multiLang />
          ),
          id: "title",
        },
        {
          component: (props: ItemAutoFormComponentProps) => (
            <AutoFormEmojiIcon
              {...props}
              allow={ICON_ONLY}
              allowRemove
              label={t("form.icon")}
              placeholder={t("form.iconPlaceholder")}
            />
          ),
          id: "icon",
        },
        {
          component: (props: ItemAutoFormComponentProps) => (
            <AutoFormTextarea
              {...props}
              label={t("form.description")}
              multiLang
              rows={2}
            />
          ),
          id: "description",
        },
        {
          component: (props: ItemAutoFormComponentProps) => (
            <AutoFormSwitch
              {...props}
              description={t("form.openInNewTabDesc")}
              label={t("form.openInNewTab")}
            />
          ),
          id: "isOpenInNewTab",
        },
      ]}
      formSchema={formSchema}
      // The submit button disables itself while the form is invalid, so a
      // rejected URL would otherwise never get to say why: `onSubmit` reveals
      // an error only once a submit has been attempted, and one cannot be.
      mode="onBlur"
      onSubmit={onSubmit}
      submitButtonProps={{
        children: t(`${isEdit ? "edit" : "create"}.submit`),
      }}
    />
  );
};
