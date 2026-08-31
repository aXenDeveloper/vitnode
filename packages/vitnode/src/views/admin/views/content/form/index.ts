/**
 * The primitives a custom Content Engine form layout is built from.
 *
 * Published as `@vitnode/core/content/admin-form`. Everything here runs inside
 * the one `AutoForm` instance the Content Engine created: one schema, one submit
 * path, one set of errors. A layout decides *where* a field appears and nothing
 * else - validation, defaults, mutations, version preconditions, structured
 * errors, publication state, translations, permissions, toasts, cache
 * invalidation, events, search and delivery all stay where they were.
 *
 * ## What is deliberately not exported here
 *
 * `./transport`, `./navigation` and `./diff` are the engine's own seams - how a
 * mutation reaches the API, what happens to the screen afterwards, and which
 * values are sent at all. They are next door and they are not on this list,
 * because a layout that could reach one of them would be a plugin overriding
 * the version precondition, the translation diff or the cache invalidation from
 * a component whose job is deciding which column a field sits in. A layout that
 * needs to *read* the form's state has `useContentForm()`, which is exactly the
 * presentation half.
 */
export {
  type ContentFormContextValue,
  type ContentFormHeaderValue,
  type ContentFormLinkComponent,
  useContentForm,
  useContentFormOptional,
} from "./context";
export {
  ContentFormActions,
  ContentFormField,
  ContentFormHeader,
  ContentFormLayoutGrid,
  ContentFormMain,
  ContentFormRemainingFields,
  ContentFormSection,
  ContentFormSidebar,
  ContentFormStatus,
} from "./primitives";
export { ContentFormPublication } from "./publication-status";
