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

/**
 * The `user` field, as the AdminCP form renders it.
 *
 * An **adapter**, and deliberately a thin one. `AutoFormUser` speaks user ids,
 * because that is the sane thing for a form value to be; a Content Engine
 * reference field holds `{ label, value }`, because that is what lets a saved
 * record show a name without a second round trip. Rather than change one to suit
 * the other - which would mean touching the schema, the payload conversion and
 * every content type in the wild - the two meet here.
 *
 * The options this field has seen are remembered so that picking somebody can
 * rebuild the pair: the picker reports an id and nothing else, and the label has
 * to come from the search that offered them.
 */
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
  const seen = React.useRef<Record<number, UserOption>>({});
  /** The author, once looked up - the record arrives with a name and no face. */
  const [resolved, setResolved] = React.useState<null | UserOption>(null);

  const current = asReference(field.value);
  const parsedId = current === null ? Number.NaN : Number(current.value);
  // `NaN` for a reference whose identifier is not a number - a hand-edited form
  // value, or a target keyed by something else. Treated as "nothing chosen"
  // rather than rendered, because `NaN` in a trigger helps nobody.
  const currentId = Number.isInteger(parsedId) ? parsedId : null;
  const currentLabel = current?.label ?? "";

  const toUser = React.useCallback(
    (option: ContentOption): UserOption => ({
      // The picker route sends these two only for a `user` field.
      avatarColor: option.avatarColor ?? "",
      id: Number(option.value),
      name: option.label,
      nameCode: option.nameCode ?? "",
    }),
    [],
  );

  /**
   * Fetches the face behind the name the record arrived with.
   *
   * A record carries its author's *label* and nothing else - that is what the
   * detail route resolves - so on an edit form the field would otherwise sit on
   * a placeholder until somebody opened the picker for no reason. One lookup,
   * searched by the label the row already has and matched by **id**, which is
   * why a near-miss on the name cannot put the wrong person's avatar here.
   *
   * Skipped entirely when there is no author, and re-run only when the id
   * actually changes - picking somebody from the list resolves them by itself,
   * because the option that was clicked carried a colour with it.
   */
  React.useEffect(() => {
    // No reset when the author is cleared: `resolved` is only ever read when its
    // id still matches, so stale state cannot surface - and clearing it here
    // would be a `setState` in an effect for no visible gain.
    if (currentId === null || seen.current[currentId]) return;

    let active = true;
    void loadOptions({ field: spec.name, search: currentLabel })
      .then(options => {
        if (!active) return;

        const match = options.map(toUser).find(user => user.id === currentId);
        if (!match) return;

        seen.current[match.id] = match;
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

          const option = seen.current[id];
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
          seen.current[user.id] = user;

          return user;
        });
      }}
      searchPlaceholder={t("relation.search_placeholder")}
      selected={
        currentId === null
          ? null
          : // The looked-up person once there is one, and the bare name until
            // then - so the field reads correctly on the very first paint and
            // grows a face a moment later rather than flashing empty. Matched on
            // id, so a resolved author never labels the one chosen after them.
            resolved?.id === currentId
            ? resolved
            : { id: currentId, name: currentLabel }
      }
    />
  );
};
