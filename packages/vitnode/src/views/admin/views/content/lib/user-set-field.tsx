import { useTranslations } from "next-intl";

import type { ItemAutoFormComponentProps } from "@/components/form/auto-form";
import type { ContentFormFieldSpec } from "@/content/admin/spec";

import { AutoFormCombobox } from "@/components/form/fields/combobox";
import { UserOptionRow } from "@/components/form/fields/input-users";

import type { ContentOption, ContentOptionsLoader } from "./field-component";

import { contentOptionsQueryKey } from "./options-query";
import { ContentReferenceChipSkeleton } from "./reference-chip-skeleton";
import { useReferenceOptions } from "./reference-options";
import { contentOptionToUser } from "./user-option";

export const ContentUserSetField = ({
  field,
  loadOptions,
  spec,
  ...props
}: ItemAutoFormComponentProps & {
  loadOptions: ContentOptionsLoader;
  spec: ContentFormFieldSpec;
}) => {
  const t = useTranslations("core.content.form");
  const selected = Array.isArray(field.value) ? (field.value as number[]) : [];
  const { known, pending, remember } = useReferenceOptions({
    field: spec.name,
    ids: selected,
    load: loadOptions,
  });

  const optionFor = (id: number): ContentOption =>
    known[id] ?? { label: String(id), value: String(id) };

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
        pending(Number(item.value)) ? (
          <ContentReferenceChipSkeleton avatar />
        ) : (
          <UserOptionRow size={16} user={contentOptionToUser(item)} />
        )
      }
      renderItem={item => <UserOptionRow user={contentOptionToUser(item)} />}
      searchPlaceholder={t("relation.search_placeholder")}
    />
  );
};
