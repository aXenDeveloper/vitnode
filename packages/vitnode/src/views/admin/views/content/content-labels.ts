import type { ContentLabelTranslator } from "@/content/admin/labels";
import type { RegisteredFrontendContentType } from "@/content/admin/registry";

import {
  contentI18nKeys,
  contentNouns,
  humanizeFieldName,
} from "@/content/admin/labels";

/**
 * Every display string one content type's screens need, in the reader's
 * language.
 *
 * The **one** label resolver, framework-neutral: it takes a translator and
 * returns strings, so `getTranslations()` from `next-intl/server` and
 * `createTranslator` from `use-intl` both drive it. The Next.js
 * `getContentLabels` awaits its translator and hands it here; the TanStack
 * loader builds one from the messages it warmed and hands it here.
 *
 * Nothing about the rules moved. `contentI18nKeys` says where a string lives,
 * `contentNouns` resolves the ICU plural that names the record, and
 * `humanizeFieldName` is the fallback for everything a plugin has not
 * translated. Every key is optional and nothing is read without `has` first, so
 * a plugin that ships no messages at all still gets a readable screen.
 */
export interface ContentLabels {
  desc: string | undefined;
  labelEnum: (field: string, value: string) => string;
  labelField: (name: string) => string;
  labelSection: (name: string) => { desc: string | undefined; title: string };
  plural: string;
  singular: string;
  title: string;
}

/**
 * The half of {@link ContentLabels} that can cross a serialization boundary.
 *
 * Four strings and none of the three resolvers, and the distinction is not
 * cosmetic: a TanStack Start loader's return value is serialized into the SSR
 * payload for the browser to hydrate from, and a function is not serializable -
 * so returning the whole object logged a `SerovalUnsupportedTypeError` naming
 * `labelEnum` on every single content navigation and left the browser to re-run
 * the loader for data it had already been sent.
 *
 * Nothing loses a label over it. A resolver reads a key assembled at runtime
 * from the content type id, and both screens that need one already rebuild the
 * whole set from the messages the route warmed - `useContentTypeForm` for a
 * form, `ContentListScreen` for a table - because that is the only way to keep
 * a spec's identity stable across renders. The nouns are what a *route* knows:
 * its title, its description and its crumb.
 */
export type ContentRouteLabels = Pick<
  ContentLabels,
  "desc" | "plural" | "singular" | "title"
>;

/** {@link ContentLabels}, narrowed to what a loader may return. */
export const contentRouteLabels = ({
  desc,
  plural,
  singular,
  title,
}: ContentLabels): ContentRouteLabels => ({ desc, plural, singular, title });

export const contentLabelsFrom = (
  entry: Pick<RegisteredFrontendContentType, "definition" | "pluginId">,
  t: ContentLabelTranslator,
): ContentLabels => {
  const { definition, pluginId } = entry;
  const keys = contentI18nKeys(definition, pluginId);

  return {
    desc: t.has(keys.desc) ? t(keys.desc) : undefined,
    labelEnum: (field, value) => {
      const key = keys.enumValue(field, value);

      return t.has(key) ? t(key) : humanizeFieldName(value);
    },
    labelField: name => {
      const key = keys.field(name);

      return t.has(key) ? t(key) : humanizeFieldName(name);
    },
    labelSection: name => {
      const section = keys.section(name);

      return {
        desc: t.has(section.desc) ? t(section.desc) : undefined,
        title: t.has(section.title)
          ? t(section.title)
          : humanizeFieldName(name),
      };
    },
    ...contentNouns(definition, pluginId, t),
  };
};

/**
 * The message namespaces one content type's screens render from.
 *
 * Three, and each is needed for a different half of the screen:
 *
 *     core.global   the shared components - pagination, tables, dialogs, dates
 *     core.content  the engine's own copy - headings, empty states, every error
 *     {pluginId}    this content type's nouns, field, enum and section labels
 *
 * The last is per-plugin because `contentI18nKeys` builds every one of those
 * keys as `{pluginId}.content.{entity}.…`, which is why this is a function
 * rather than a constant - and why the whole set is warmed by the route's loader
 * rather than by the shell, which does not yet know which content type the slug
 * resolves to.
 *
 * The same three the Next.js screen mounts. `<I18nProvider>` names two -
 * `namespaces={["core.content"]} runtimeNamespaces={[pluginId]}` - and prepends
 * `core.global` itself, for every page in the application. A TanStack Start
 * route's `RouteMessages` has no such floor: `use-intl`'s provider *replaces*
 * the record rather than merging with the one above it, so a set that left
 * `core.global` out rendered a content list whose pagination threw
 * `MISSING_MESSAGE: core.global` on the server and fell back to client
 * rendering. Every other admin route's namespace set names it for the same
 * reason.
 */
export const contentRouteNamespaces = (pluginId: string): string[] => [
  "core.global",
  "core.content",
  pluginId,
];
