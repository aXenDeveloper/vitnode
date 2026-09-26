import { useSelector } from "@tanstack/react-form";
import { ChevronDownIcon, ExternalLinkIcon, LockIcon } from "lucide-react";
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
  AutoFormSubmitButton,
  setFormFieldError,
} from "@/components/form/auto-form";
import { AutoFormEmojiIcon } from "@/components/form/fields/emoji-icon";
import { AutoFormInput } from "@/components/form/fields/input";
import { AutoFormSelect } from "@/components/form/fields/select";
import { AutoFormSwitch } from "@/components/form/fields/switch";
import { AutoFormTextarea } from "@/components/form/fields/textarea";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter, useDialog } from "@/components/ui/dialog";
import { EmojiIcon } from "@/components/ui/emoji-icon";
import { useFormApi } from "@/components/ui/form";
import { EMOJI_ICON_MAX_LENGTH, parseEmojiIcon } from "@/lib/emoji-icon";
import { multiLangValueSchema } from "@/lib/helpers/multi-lang";
import {
  isValidNavigationHref,
  NAVIGATION_DESCRIPTION_MAX_LENGTH,
  NAVIGATION_HREF_MAX_LENGTH,
  NAVIGATION_TITLE_MAX_LENGTH,
  navigationItemLabels,
  navigationPresetKey,
} from "@/lib/navigation";

import type { AdminNavigationItem } from "./navigation-query";

import {
  prefillNavigationText,
  stripDefaultNavigationText,
} from "./navigation-form-texts";
import { presetLabelSource, useNavigationTranslate } from "./navigation-labels";
import { navigationItemIcon } from "./navigation-tree";

export interface AdminNavigationFormValues {
  description: MultiLangValue;
  href: string;
  icon: string;
  isOpenInNewTab: boolean;
  kind: NavigationKind;
  preset: string;
  title: MultiLangValue;
}

export interface AdminNavigationSaveArgs {
  id?: number;
  parentId?: null | number;
  values: AdminNavigationFormValues;
}

export interface AdminNavigationFormProps {
  data?: AdminNavigationItem;
  items: AdminNavigationItem[];
  kind?: NavigationKind;
  onSave: (
    args: AdminNavigationSaveArgs,
  ) => Promise<AdminMutationResult<unknown>>;
  onSaved?: (name: string) => void;
  parentId?: null | number;
  preset?: NavigationPreset;
  presets: NavigationPreset[];
  surface: "dialog" | "sheet";
}

const ICON_ONLY = ["icon"] as const;
const TOP_LEVEL = "root";

const hasText = (values: readonly NavigationText[]): boolean =>
  values.some(item => item.value.trim().length > 0);

const parentKey = (parentId: null | number | undefined): string =>
  parentId === null || parentId === undefined ? TOP_LEVEL : String(parentId);

const parentFromKey = (key: string): null | number =>
  key === TOP_LEVEL ? null : Number(key);

export const NavigationPresetSummary = ({
  missingPluginId,
  preset,
}: {
  missingPluginId?: null | string;
  preset: NavigationPreset | undefined;
}) => {
  const t = useTranslations("admin.navigation.form");
  const locale = useLocale();
  const translate = useNavigationTranslate();

  const title = preset
    ? navigationItemLabels({
        item: presetLabelSource(preset),
        locale,
        translate,
      }).title
    : "";

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm leading-snug font-medium">{t("preset")}</span>

      <div className="bg-muted/40 flex min-w-0 items-center gap-3 rounded-md border px-3 py-2">
        <EmojiIcon
          className="text-muted-foreground size-4.5 shrink-0"
          value={parseEmojiIcon(preset?.icon)}
        />

        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">
            {preset ? title || preset.id : (missingPluginId ?? "")}
          </span>
          <span className="text-muted-foreground truncate font-mono text-xs">
            {preset ? preset.href : t("presetMissing")}
          </span>
        </div>

        <LockIcon
          aria-hidden
          className="text-muted-foreground ms-auto size-3.5 shrink-0"
        />
      </div>

      <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
        {t("presetLocked")}
      </p>
    </div>
  );
};

interface PreviewSource {
  items: AdminNavigationItem[];
  kind: NavigationKind;
  preset?: NavigationPreset;
  presetIds: { pluginId: null | string; presetId: null | string };
}

const NavigationFormPreview = ({
  items,
  kind,
  preset,
  presetIds,
}: PreviewSource) => {
  const t = useTranslations("admin.navigation.form");
  const locale = useLocale();
  const translate = useNavigationTranslate();
  const { form } = useFormApi();
  const values = useSelector(
    form.store,
    state => state.values as Record<string, unknown>,
  );

  const title = (values.title ?? []) as NavigationText[];
  const description = (values.description ?? []) as NavigationText[];
  const href = typeof values.href === "string" ? values.href : "";
  const labels = navigationItemLabels({
    item: { description, kind, ...presetIds, title },
    locale,
    translate,
  });
  const label =
    [labels.title, href, preset?.href].find(
      (value): value is string => typeof value === "string" && value !== "",
    ) ?? t("previewUntitled");
  const icon = parseEmojiIcon(
    typeof values.icon === "string" ? values.icon : null,
  );
  const opensInNewTab = values.isOpenInNewTab === true;
  const parentId = parentFromKey(
    typeof values.parentId === "string" ? values.parentId : TOP_LEVEL,
  );
  const parent = items.find(item => item.id === parentId);
  const parentLabel = parent
    ? navigationItemLabels({ item: parent, locale, translate }).title
    : "";

  const newTab = opensInNewTab ? (
    <ExternalLinkIcon
      aria-label={t("openInNewTab")}
      className="text-muted-foreground size-3.5 shrink-0"
      role="img"
    />
  ) : null;

  return (
    <figure className="bg-muted/50 flex flex-col gap-2 rounded-lg border p-3">
      <figcaption className="text-muted-foreground text-xs font-medium">
        {t("preview")}
      </figcaption>

      {parent ? (
        <div className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <EmojiIcon
              className="size-4"
              value={parseEmojiIcon(navigationItemIcon(parent))}
            />
            {parentLabel}
            <ChevronDownIcon
              aria-hidden
              className="text-muted-foreground size-3.5 rotate-180"
            />
          </span>

          <div className="bg-popover flex items-start gap-2.5 rounded-md p-2.5 shadow-sm">
            <EmojiIcon
              className="text-muted-foreground mt-0.5 size-4"
              value={icon}
            />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <span className="truncate">{label}</span>
                {newTab}
              </span>
              {labels.description ? (
                <span className="text-muted-foreground text-xs leading-relaxed text-pretty">
                  {labels.description}
                </span>
              ) : null}
            </span>
          </div>
        </div>
      ) : (
        <span className="bg-background flex h-9 w-fit max-w-full min-w-0 items-center gap-2 rounded-md px-3 text-sm font-medium shadow-xs">
          <EmojiIcon className="size-4" value={icon} />
          <span className="truncate">{label}</span>
          {newTab}
        </span>
      )}
    </figure>
  );
};

const SheetSection = ({
  children,
  id,
  title,
}: {
  children: React.ReactNode;
  id: string;
  title: string;
}) => (
  <section aria-labelledby={id} className="flex flex-col gap-4">
    <h3 className="text-sm font-semibold" id={id}>
      {title}
    </h3>
    {children}
  </section>
);

export const AdminNavigationFormContent = ({
  data,
  items,
  kind: kindProp,
  onSave,
  onSaved,
  parentId: parentIdProp = null,
  preset: chosenPreset,
  presets,
  surface,
}: AdminNavigationFormProps) => {
  const t = useTranslations("admin.navigation");
  const tCore = useTranslations("core.global");
  const tErrors = useTranslations("core.global.errors");
  const locale = useLocale();
  const translate = useNavigationTranslate();
  const { setIsDirty, setOpen } = useDialog();

  const isEdit = data !== undefined;
  const kind: NavigationKind = data?.kind ?? kindProp ?? "custom";
  const preset =
    chosenPreset ??
    (data?.kind === "preset" && data.pluginId && data.presetId
      ? presets.find(
          entry =>
            entry.pluginId === data.pluginId && entry.id === data.presetId,
        )
      : undefined);
  const presetIds = {
    pluginId: preset?.pluginId ?? data?.pluginId ?? null,
    presetId: preset?.id ?? data?.presetId ?? null,
  };
  const presetDefaults = preset
    ? navigationItemLabels({
        item: presetLabelSource(preset),
        locale,
        translate,
      })
    : undefined;

  const currentParentId = data ? data.parentId : parentIdProp;
  const childCount = data
    ? items.filter(item => item.parentId === data.id).length
    : 0;
  const parentOptions = items
    .filter(item => item.parentId === null && item.id !== data?.id)
    .sort((a, b) => a.position - b.position || a.id - b.id);
  const isChild =
    surface === "sheet"
      ? true
      : parentIdProp !== null && parentIdProp !== undefined;

  const formSchema = z.object({
    href: z
      .string()
      .max(NAVIGATION_HREF_MAX_LENGTH)
      .refine(value => value === "" || isValidNavigationHref(value), {
        message: t("errors.hrefInvalid"),
      })
      .default(data?.href ?? ""),
    title: multiLangValueSchema({
      maxLength: NAVIGATION_TITLE_MAX_LENGTH,
    }).default(
      prefillNavigationText({
        fallback: presetDefaults?.title,
        locale,
        stored: data?.title ?? [],
      }),
    ),
    icon: z
      .string()
      .max(EMOJI_ICON_MAX_LENGTH)
      .default(data?.icon ?? preset?.icon ?? ""),
    description: multiLangValueSchema({
      maxLength: NAVIGATION_DESCRIPTION_MAX_LENGTH,
    }).default(
      prefillNavigationText({
        fallback: presetDefaults?.description,
        locale,
        stored: data?.description ?? [],
      }),
    ),
    isOpenInNewTab: z
      .boolean()
      .default(data?.isOpenInNewTab ?? preset?.isOpenInNewTab ?? false),
    parentId: z
      .enum([TOP_LEVEL, ...parentOptions.map(item => String(item.id))])
      .default(parentKey(currentParentId)),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async (
    { parentId: parentValue, ...values },
    form,
  ) => {
    if (kind === "custom") {
      if (!isValidNavigationHref(values.href)) {
        setFormFieldError(form, "href", t("errors.hrefInvalid"));

        return;
      }
      if (!hasText(values.title)) {
        setFormFieldError(form, "title", t("errors.titleRequired"));

        return;
      }
    }

    const nextParentId =
      surface === "sheet" ? parentFromKey(parentValue) : parentIdProp;

    const result = await onSave({
      id: data?.id,
      parentId:
        isEdit && nextParentId === data.parentId ? undefined : nextParentId,
      values: {
        ...values,
        description: stripDefaultNavigationText({
          fallback: presetDefaults?.description,
          values: values.description,
        }),
        icon: values.icon === preset?.icon ? "" : values.icon,
        kind,
        preset: preset ? navigationPresetKey(preset.pluginId, preset.id) : "",
        title: stripDefaultNavigationText({
          fallback: presetDefaults?.title,
          values: values.title,
        }),
      },
    });

    if ("error" in result) {
      toast.error(tErrors("title"), {
        description:
          result.error.status === 409
            ? t("errors.presetTaken")
            : tErrors("internal_server_error"),
      });

      return;
    }

    const name =
      navigationItemLabels({
        item: {
          description: values.description,
          kind,
          ...presetIds,
          title: values.title,
        },
        locale,
        translate,
      }).title || values.href;

    toast.success(t(isEdit ? "edit.success" : "create.success"), {
      description: t(isEdit ? "edit.successDesc" : "create.successDesc", {
        name,
      }),
    });
    setIsDirty?.(false);
    setOpen?.(false);
    onSaved?.(name);
  };

  const fields = [
    ...(kind === "custom"
      ? [
          {
            component: (props: ItemAutoFormComponentProps) => (
              <AutoFormInput
                {...props}
                autoComplete="off"
                inputMode="url"
                label={t("form.href")}
                placeholder={t("form.hrefPlaceholder")}
                spellCheck={false}
              />
            ),
            id: "href",
          },
        ]
      : []),
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
    ...(isChild
      ? [
          {
            component: (props: ItemAutoFormComponentProps) => (
              <AutoFormTextarea
                {...props}
                description={t("form.descriptionDesc")}
                label={t("form.description")}
                multiLang
                rows={2}
              />
            ),
            id: "description",
          },
        ]
      : []),
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
    ...(surface === "sheet"
      ? [
          {
            component: (props: ItemAutoFormComponentProps) => (
              <AutoFormSelect
                {...props}
                description={
                  childCount > 0
                    ? t("form.parentLocked", { count: childCount })
                    : t("form.parentDesc")
                }
                disabled={childCount > 0}
                label={t("form.parent")}
                labels={[
                  { label: t("form.parentRoot"), value: TOP_LEVEL },
                  ...parentOptions.map(item => ({
                    label: t("form.parentInside", {
                      name: navigationItemLabels({ item, locale, translate })
                        .title,
                    }),
                    value: String(item.id),
                  })),
                ]}
              />
            ),
            id: "parentId",
          },
        ]
      : []),
  ];

  const presetSummary =
    kind === "preset" ? (
      <NavigationPresetSummary
        missingPluginId={data?.pluginId}
        preset={preset}
      />
    ) : null;

  if (surface === "sheet") {
    return (
      <AutoForm
        className="flex min-h-0 flex-1 flex-col space-y-0"
        fields={fields}
        formSchema={formSchema}
        layout={rendered => (
          <>
            <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4">
              <NavigationFormPreview
                items={items}
                kind={kind}
                preset={preset}
                presetIds={presetIds}
              />

              <SheetSection
                id="navigation-form-destination"
                title={t("form.sections.destination")}
              >
                {presetSummary ?? rendered.href}
                {rendered.isOpenInNewTab}
              </SheetSection>

              <SheetSection
                id="navigation-form-label"
                title={t("form.sections.label")}
              >
                {rendered.title}
                {rendered.icon}
                {rendered.description}
              </SheetSection>

              <SheetSection
                id="navigation-form-position"
                title={t("form.sections.position")}
              >
                {rendered.parentId}
              </SheetSection>
            </div>

            <div className="flex justify-end gap-2 border-t p-4">
              <DialogClose
                render={<Button variant="outline">{tCore("cancel")}</Button>}
              />
              <AutoFormSubmitButton>{t("edit.submit")}</AutoFormSubmitButton>
            </div>
          </>
        )}
        mode="onBlur"
        onSubmit={onSubmit}
      />
    );
  }

  return (
    <AutoForm
      fields={fields}
      formSchema={formSchema}
      layout={rendered => (
        <>
          <div className="flex flex-col gap-5">
            {rendered.href}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {rendered.title}
              {rendered.icon}
            </div>
            {rendered.description}
            {rendered.isOpenInNewTab}
          </div>

          <DialogFooter>
            <AutoFormSubmitButton>{t("create.submit")}</AutoFormSubmitButton>
          </DialogFooter>
        </>
      )}
      mode="onBlur"
      onSubmit={onSubmit}
    />
  );
};
