import { useTranslations } from "next-intl";

import type { ItemAutoFormComponentProps } from "@/components/form/auto-form";
import type { ContentFormFieldSpec } from "@/content/admin/spec";

import { AutoFormCombobox } from "@/components/form/fields/combobox";

import type { ContentOption, ContentOptionsLoader } from "./field-component";

import { ContentOptionSwatch } from "./option-swatch";
import { contentOptionsQueryKey } from "./options-query";
import { ContentReferenceChipSkeleton } from "./reference-chip-skeleton";
import { useReferenceOptions } from "./reference-options";

export interface ContentRelationSetFieldProps extends ItemAutoFormComponentProps {
  labels?: Record<number, string>;
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
  const selected = Array.isArray(field.value) ? (field.value as number[]) : [];
  const { known, pending, remember } = useReferenceOptions({
    field: spec.name,
    ids: selected,
    load: loadOptions,
  });

  const optionFor = (id: number): ContentOption =>
    known[id] ?? { label: labels[id] ?? String(id), value: String(id) };
  const isPending = (id: number): boolean =>
    labels[id] === undefined && pending(id);

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

          field.onChange(items.map(item => Number(item.value)));
        },
        value: selected.map(optionFor),
      }}
      id={`content-${spec.name}`}
      label={spec.label}
      multiple
      placeholder={t("relation.placeholder")}
      queryKey={contentOptionsQueryKey(spec)}
      renderChip={item =>
        isPending(Number(item.value)) ? (
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
