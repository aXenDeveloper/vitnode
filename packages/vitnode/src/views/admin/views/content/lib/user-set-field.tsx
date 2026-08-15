import { useTranslations } from "next-intl";

import type { ItemAutoFormComponentProps } from "@/components/form/auto-form";
import type { ContentFormFieldSpec } from "@/content/admin/spec";

import { AutoFormCombobox } from "@/components/form/fields/combobox";
import { UserOptionRow } from "@/components/form/fields/input-users";

import type { ContentOption, ContentOptionsLoader } from "./field-component";

import { ContentReferenceChipSkeleton } from "./reference-chip-skeleton";
import { useReferenceOptions } from "./reference-options";
import { contentOptionToUser } from "./user-option";

/**
 * The picker for a to-many `user` field - an article's authors, a project's
 * maintainers.
 *
 * One multi-select combobox rather than a picker with a list under it: the
 * people who are chosen are chips inside the control, each removable, and the
 * same input searches for the next one. That is the shadcn `multiple`
 * composition, and using it means this field and every other multi-value field
 * in the AdminCP are visibly the same control.
 *
 * The form value stays a list of **user ids**, in the order the engine will
 * store them - the combobox holds whole options so a chip can show a face, and
 * the two are converted at this boundary rather than anywhere deeper.
 */
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
          // Remembered on the way past, so a person chosen a moment ago still
          // has a face if the search that offered them is replaced.
          remember(items);

          field.onChange(items.map(item => Number(item.value)));
        },
        value: selected.map(optionFor),
      }}
      id={`content-${spec.name}`}
      label={spec.label}
      multiple
      placeholder={t("relation.placeholder")}
      renderChip={item =>
        pending(Number(item.value)) ? (
          // A face and a handle, not just a name: the chip is two shapes wide
          // and settling into one of them would move the row.
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
