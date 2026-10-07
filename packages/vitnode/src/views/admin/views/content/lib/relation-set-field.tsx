import { useLocale, useTranslations } from "use-intl";

import type { ItemAutoFormComponentProps } from "@/components/form/auto-form";
import type { ContentFormFieldSpec } from "@/content/admin/spec";
import type { ContentId } from "@/content/ids";

import { AutoFormCombobox } from "@/components/form/fields/combobox";
import { contentOptionValueToId } from "@/content/admin/spec";
import { contentIdKey } from "@/content/ids";

import type { ContentOption, ContentOptionsLoader } from "./field-component";

import { ContentOptionSwatch } from "./option-swatch";
import { contentOptionsQueryKey } from "./options-query";
import { ContentReferenceChipSkeleton } from "./reference-chip-skeleton";
import { useReferenceOptions } from "./reference-options";

export interface ContentRelationSetFieldProps extends ItemAutoFormComponentProps {
  /** Labels the row already resolved, keyed by `contentIdKey(id)`. */
  labels?: Record<string, string>;
  loadOptions: ContentOptionsLoader;
  spec: ContentFormFieldSpec;
}

export const ContentRelationSetField = ({
  field,
  labels = {},
  loadOptions,
  spec,
  ...props
}: ContentRelationSetFieldProps) => {
  const t = useTranslations("core.content.form");
  const locale = useLocale();
  // A number per serial target, a canonical string per `uuid` or `bigint` one.
  const selected = Array.isArray(field.value)
    ? (field.value as ContentId[])
    : [];
  const { known, pending, remember } = useReferenceOptions({
    field: spec.name,
    ids: selected,
    load: loadOptions,
  });

  const optionFor = (id: ContentId): ContentOption => {
    const key = contentIdKey(id);

    return known[key] ?? { label: labels[key] ?? key, value: key };
  };
  const isPending = (value: string): boolean => {
    const id = contentOptionValueToId(spec, value);

    return id !== null && labels[value] === undefined && pending(id);
  };

  return (
    <AutoFormCombobox
      {...props}
      fetchData={async ({ search }) =>
        await loadOptions({ field: spec.name, search })
      }
      field={{
        ...field,
        onChange: (value: unknown) => {
          const items = (value ?? []) as ContentOption[];
          remember(items);

          field.onChange(
            items
              .map(item => contentOptionValueToId(spec, item.value))
              .filter((id): id is ContentId => id !== null),
          );
        },
        value: selected.map(optionFor),
      }}
      id={`content-${spec.name}`}
      label={spec.label}
      multiple
      placeholder={t("relation.placeholder")}
      queryKey={contentOptionsQueryKey(spec, locale)}
      renderChip={item =>
        isPending(item.value) ? (
          <ContentReferenceChipSkeleton />
        ) : (
          <ContentOptionSwatch option={item} />
        )
      }
      renderItem={item => <ContentOptionSwatch option={item} />}
      searchPlaceholder={t("relation.search_placeholder")}
    />
  );
};
