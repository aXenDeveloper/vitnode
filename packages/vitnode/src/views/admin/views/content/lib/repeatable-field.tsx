import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import type { ItemAutoFormComponentProps } from "@/components/form/auto-form";
import type { ContentFormFieldSpec } from "@/content/admin/spec";

import { Button } from "@/components/ui/button";

import type { ContentOptionsLoader } from "./field-component";

import { ContentLeafField } from "./leaf-field";

export interface ContentRepeatableFieldProps extends ItemAutoFormComponentProps {
  loadOptions: ContentOptionsLoader;
  spec: ContentFormFieldSpec;
}

/** One row as the editor holds it: the API's shape plus a key for React. */
interface EditorRow {
  key: string;
  values: Record<string, unknown>;
}

const toRows = (value: unknown): EditorRow[] =>
  Array.isArray(value)
    ? (value as Record<string, unknown>[]).map((values, index) => ({
        key:
          typeof values.id === "number"
            ? `saved-${values.id}`
            : `draft-${index}`,
        values,
      }))
    : [];

export const ContentRepeatableField = ({
  field,
  loadOptions,
  spec,
  ...props
}: ContentRepeatableFieldProps) => {
  const t = useTranslations("core.content.form");
  const leaves = spec.fields ?? [];
  const rows = toRows(field.value);
  const max = spec.maxItems ?? Number.MAX_SAFE_INTEGER;
  const legendId = `content-repeatable-${spec.name}`;

  const nextKeyRef = React.useRef(0);

  const commit = (next: EditorRow[]) => {
    field.onChange(next.map(row => row.values));
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= rows.length) return;

    const next = [...rows];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    commit(next);
  };

  return (
    <fieldset className="rounded-lg border p-4">
      <legend className="text-sm font-medium" id={legendId}>
        {spec.label}
      </legend>

      {!!spec.description && (
        <p className="text-muted-foreground text-sm">{spec.description}</p>
      )}

      {rows.length === 0 && (
        <p className="text-muted-foreground mt-4 text-sm">{t("list.empty")}</p>
      )}

      <ul className="mt-4 flex flex-col gap-4">
        {rows.map((row, index) => {
          const position = t("list.position", {
            label: spec.label,
            position: index + 1,
            total: rows.length,
          });

          return (
            <li className="rounded-lg border p-4" key={row.key}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted-foreground text-sm">
                  {position}
                </span>

                <div className="flex items-center gap-1">
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
                    disabled={index === rows.length - 1}
                    onClick={() => {
                      move(index, index + 1);
                    }}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <ArrowDownIcon aria-hidden />
                  </Button>
                  <Button
                    aria-label={t("list.remove", { position: index + 1 })}
                    onClick={() => {
                      commit(rows.filter((_, at) => at !== index));
                    }}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2Icon aria-hidden />
                  </Button>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-4">
                {leaves.map(leaf => (
                  <ContentLeafField
                    key={leaf.name}
                    loadOptions={loadOptions}
                    name={`${field.name}.${index}.${leaf.name}`}
                    onChange={next => {
                      commit(
                        rows.map((item, at) =>
                          at === index
                            ? {
                                ...item,
                                values: { ...item.values, [leaf.name]: next },
                              }
                            : item,
                        ),
                      );
                    }}
                    otherProps={props.otherProps}
                    spec={leaf}
                    value={row.values[leaf.name]}
                  />
                ))}
              </div>
            </li>
          );
        })}
      </ul>

      <Button
        className="mt-4"
        disabled={rows.length >= max}
        onClick={() => {
          nextKeyRef.current += 1;
          commit([...rows, { key: `new-${nextKeyRef.current}`, values: {} }]);
        }}
        size="sm"
        type="button"
        variant="outline"
      >
        <PlusIcon aria-hidden />
        {t("list.add", { label: spec.label })}
      </Button>
    </fieldset>
  );
};
