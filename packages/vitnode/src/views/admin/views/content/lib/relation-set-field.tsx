import { ArrowDownIcon, ArrowUpIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import React from "react";

import type { ItemAutoFormComponentProps } from "@/components/form/auto-form";
import type { ContentFormFieldSpec } from "@/content/admin/spec";

import { AutoFormCombobox } from "@/components/form/fields/combobox";
import { Button } from "@/components/ui/button";

import type { ContentOptionsLoader } from "./field-component";

export interface ContentRelationSetFieldProps extends ItemAutoFormComponentProps {
  /** Labels the row already resolved, keyed by target id. */
  labels?: Record<number, string>;
  loadOptions: ContentOptionsLoader;
  spec: ContentFormFieldSpec;
}

/**
 * The picker for a to-many relation.
 *
 * The combobox already exists and already knows how to search a target content
 * type through a server action, so this is a list *around* it rather than a
 * second picker: choose one, it appends; choose another, it appends again.
 *
 * Reorder controls appear only for an `ordered: true` relation. For an
 * unordered one the engine stores the set in ascending target-id order whatever
 * the editor does, and offering buttons that visibly do nothing would be worse
 * than offering none.
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
  // Labels resolved by the picker this session, on top of the ones the row
  // arrived with - so a target chosen a moment ago still reads as its name.
  const [resolved, setResolved] = React.useState<Record<number, string>>({});
  const legendId = `content-relation-${spec.name}`;

  const labelFor = (id: number): string =>
    resolved[id] ?? labels[id] ?? String(id);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= selected.length) return;

    const next = [...selected];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    field.onChange(next);
  };

  return (
    <fieldset className="rounded-lg border p-4">
      <legend className="text-sm font-medium" id={legendId}>
        {spec.label}
      </legend>

      {!!spec.description && (
        <p className="text-muted-foreground text-sm">{spec.description}</p>
      )}

      {selected.length === 0 && (
        <p className="text-muted-foreground mt-4 text-sm">{t("list.empty")}</p>
      )}

      <ul className="mt-4 flex flex-col gap-2">
        {selected.map((id, index) => (
          <li
            className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
            key={id}
          >
            <span className="text-sm">{labelFor(id)}</span>

            <div className="flex items-center gap-1">
              {spec.ordered === true && (
                <>
                  <Button
                    aria-label={t("list.move_up", { position: index + 1 })}
                    disabled={index === 0}
                    onClick={() => {
                      move(index, index - 1);
                    }}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <ArrowUpIcon aria-hidden />
                  </Button>
                  <Button
                    aria-label={t("list.move_down", { position: index + 1 })}
                    disabled={index === selected.length - 1}
                    onClick={() => {
                      move(index, index + 1);
                    }}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <ArrowDownIcon aria-hidden />
                  </Button>
                </>
              )}
              <Button
                aria-label={t("list.remove", { position: index + 1 })}
                onClick={() => {
                  field.onChange(selected.filter(item => item !== id));
                }}
                size="icon"
                type="button"
                variant="ghost"
              >
                <XIcon aria-hidden />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4">
        <AutoFormCombobox
          fetchData={async ({ search }) =>
            // The picker searches the whole target content type; the ones
            // already chosen are filtered out so the list cannot offer a
            // duplicate the service would reject.
            (await loadOptions({ field: spec.name, search })).filter(
              option => !selected.includes(Number(option.value)),
            )
          }
          field={{
            ...field,
            onChange: (option: unknown) => {
              const picked = option as null | { label: string; value: string };
              if (!picked?.value) return;

              const id = Number(picked.value);
              if (!Number.isInteger(id) || selected.includes(id)) return;

              setResolved(current => ({ ...current, [id]: picked.label }));
              field.onChange([...selected, id]);
            },
            // Always empty: the combobox is an "add one" control here, not the
            // thing that holds the value.
            value: undefined,
          }}
          id={`content-${spec.name}-add`}
          label={t("list.add", { label: spec.label })}
          otherProps={props.otherProps}
          placeholder={t("relation.placeholder")}
          searchPlaceholder={t("relation.search_placeholder")}
        />
      </div>
    </fieldset>
  );
};
