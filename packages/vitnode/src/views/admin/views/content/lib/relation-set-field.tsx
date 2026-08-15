import { useTranslations } from "next-intl";

import type { ItemAutoFormComponentProps } from "@/components/form/auto-form";
import type { ContentFormFieldSpec } from "@/content/admin/spec";

import { AutoFormCombobox } from "@/components/form/fields/combobox";

import type { ContentOption, ContentOptionsLoader } from "./field-component";

import { ContentOptionSwatch } from "./option-swatch";
import { ContentReferenceChipSkeleton } from "./reference-chip-skeleton";
import { useReferenceOptions } from "./reference-options";

export interface ContentRelationSetFieldProps extends ItemAutoFormComponentProps {
  /** Labels the row already resolved, keyed by target id. */
  labels?: Record<number, string>;
  loadOptions: ContentOptionsLoader;
  spec: ContentFormFieldSpec;
}

/**
 * The picker for a to-many relation.
 *
 * The multi-select combobox, in the shadcn `multiple` composition: what is
 * chosen sits in the control as removable chips, and the same input searches the
 * target content type for the next one. The people picker is the same control
 * with faces in it, which is the point - "several of these" should not look like
 * two different things depending on what is being chosen.
 *
 * The form value is a list of **target ids**, in the order the engine stores
 * them. For an `ordered` relation that order is the chip order, and adding
 * appends; for an unordered one the engine sorts by id on write, so the chips
 * are simply the set.
 */
export const ContentRelationSetField = ({
  field,
  labels = {},
  loadOptions,
  spec,
  ...props
}: ContentRelationSetFieldProps) => {
  const t = useTranslations("core.content.form");
  const selected = Array.isArray(field.value) ? (field.value as number[]) : [];
  // The options behind the identifiers the form opened holding, plus the ones
  // the picker resolves as the editor chooses - so a target chosen a moment ago
  // and one stored last week both read as their name, and keep their colour.
  const { known, pending, remember } = useReferenceOptions({
    field: spec.name,
    ids: selected,
    load: loadOptions,
  });

  const optionFor = (id: number): ContentOption =>
    known[id] ?? { label: labels[id] ?? String(id), value: String(id) };
  // A label the row already carried is a label: only an id nobody has resolved
  // *and* nobody has looked up yet is still loading.
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
      renderChip={item =>
        isPending(Number(item.value)) ? (
          <ContentReferenceChipSkeleton />
        ) : (
          <ContentOptionSwatch option={item} />
        )
      }
      // No skeleton in the list: every row there came back from a search that
      // carried its label.
      renderItem={item => <ContentOptionSwatch option={item} />}
      searchPlaceholder={t("relation.search_placeholder")}
    />
  );
};
