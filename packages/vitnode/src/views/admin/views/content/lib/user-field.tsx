import { useTranslations } from "next-intl";
import React from "react";

import type { ItemAutoFormComponentProps } from "@/components/form/auto-form";
import type { UserOption } from "@/components/form/fields/input-users";
import type { ContentFormFieldSpec } from "@/content/admin/spec";

import { AutoFormUser } from "@/components/form/fields/input-users";

import type { ContentOption, ContentOptionsLoader } from "./field-component";

/** What a reference field holds in the form: enough to show a name. */
interface ReferenceValue {
  label: string;
  value: string;
}

const asReference = (value: unknown): null | ReferenceValue => {
  if (typeof value !== "object" || value === null) return null;

  const entry = value as Partial<ReferenceValue>;

  return typeof entry.value === "string" && typeof entry.label === "string"
    ? { label: entry.label, value: entry.value }
    : null;
};

export const ContentUserField = ({
  loadOptions,
  spec,
  ...props
}: ItemAutoFormComponentProps & {
  loadOptions: ContentOptionsLoader;
  spec: ContentFormFieldSpec;
}) => {
  const t = useTranslations("core.content.form");
  const { field } = props;
  const seenRef = React.useRef<Record<number, UserOption>>({});
  const [resolved, setResolved] = React.useState<null | UserOption>(null);

  const current = asReference(field.value);
  const parsedId = current === null ? Number.NaN : Number(current.value);
  const currentId = Number.isInteger(parsedId) ? parsedId : null;
  const currentLabel = current?.label ?? "";

  const toUser = React.useCallback(
    (option: ContentOption): UserOption => ({
      avatarColor: option.avatarColor ?? "",
      id: Number(option.value),
      name: option.label,
      nameCode: option.nameCode ?? "",
    }),
    [],
  );

  React.useEffect(() => {
    if (currentId === null || seenRef.current[currentId]) return;

    let active = true;
    void loadOptions({ field: spec.name, search: currentLabel })
      .then(options => {
        if (!active) return;

        const match = options.map(toUser).find(user => user.id === currentId);
        if (!match) return;

        seenRef.current[match.id] = match;
        setResolved(match);
      })
      .catch((error: unknown) => {
        // A face is a nicety. Failing to fetch one leaves the placeholder,
        // which is exactly what the field renders without it anyway.
        // eslint-disable-next-line no-console
        console.error(error);
      });

    return () => {
      active = false;
    };
  }, [currentId, currentLabel, loadOptions, spec.name, toUser]);

  return (
    <AutoFormUser
      {...props}
      clearable={spec.nullable}
      field={{
        ...field,
        onChange: (id: unknown) => {
          if (typeof id !== "number") {
            field.onChange(null);

            return;
          }

          const option = seenRef.current[id];
          field.onChange({
            label: option?.name ?? String(id),
            value: String(id),
          });
        },
        value: currentId,
      }}
      label={spec.label}
      placeholder={t("relation.placeholder")}
      search={async search => {
        const options = await loadOptions({ field: spec.name, search });

        return options.map(option => {
          const user = toUser(option);
          seenRef.current[user.id] = user;

          return user;
        });
      }}
      searchPlaceholder={t("relation.search_placeholder")}
      selected={
        currentId === null
          ? null
          : // The looked-up person once there is one, and the bare name until
            resolved?.id === currentId
            ? resolved
            : { id: currentId, name: currentLabel }
      }
    />
  );
};
