import { adminQueryRoot } from "@/views/admin/table/query";

/**
 * Every cache key the Content Engine's AdminCP screens use, in one family.
 *
 * Pure, framework-neutral and transport-free: strings and arrays, nothing that
 * fetches. Both hosts build keys from here, so a mutation in one and a read in
 * the other cannot disagree about what they are naming.
 *
 *     ["vitnode", "admin", "content", "blog.post", "list", { first: "25" }]
 *      \______________________________/  \_______/  \___________________/
 *              the AdminCP root          the type      what is cached
 *
 * ## Why it hangs off the AdminCP root
 *
 * `adminQueryRoot` puts every key below under `["vitnode", "admin"]`, and that is
 * the whole of the sign-out story: `removeAdminShellQueries` drops that prefix,
 * so the Content Engine's caches go with it automatically. There is no list of
 * content roots for anybody to extend, and a content type a plugin adds tomorrow
 * is collected without a line of code.
 *
 * The alternative was live in this codebase until now, and is exactly the
 * failure worth naming: the reference-picker cache keyed itself under the bare
 * string `"content-options"`, outside that prefix and outside anything that
 * drops it. One administrator's picker results survived a sign-out and were
 * served to the next person to sign in on that tab.
 *
 * ## Why there is no administrator id in the key
 *
 * The deliberate choice, and it follows the rule `admin-scope.ts` already
 * states: an identity segment is for screens whose **answer is shaped by the
 * reader's own permissions**. Users, roles and staff are - `users:can_edit_admin`
 * decides whether a row may be edited, `self` is computed against the caller's
 * roles - so two administrators must not share an entry.
 *
 * A content list is not like that. `can_view` decides whether there is a list at
 * all, and the loader refuses before any request when it is absent; past that
 * gate every administrator gets the same rows, the same record, the same
 * revisions. What differs between two administrators is which *controls* render,
 * and that is read from the permission set rather than from any of these
 * entries. So this sits with `adminQueryRoot("cron")` and
 * `adminQueryRoot("files")`, which are the same shape for the same reason.
 *
 * Privacy is still covered, by the other mechanism: removal on sign-out drops
 * the whole `["vitnode","admin"]` prefix, this family included. If a content read
 * ever does become permission-shaped, `adminScopedQueryRoot` is the one-line
 * change and this note is the reason it would be needed.
 *
 * ## Why the content type comes before the kind
 *
 *     [...root, contentTypeId, "list" | "item" | "options", ...]
 *
 * Because the useful invalidations are almost all *per content type*. Creating a
 * category has to expire the category list **and** every article form's category
 * picker, and with the type ahead of the kind that is one `invalidateQueries` on
 * {@link contentTypeQueryRoot}. Putting the kind first would need two calls and a
 * rule about which pickers point where.
 *
 * That works because a picker is keyed by **what it offers**, not by the form it
 * sits in: `contentOptionsQueryRoot("blog.category")` is a prefix of every picker
 * offering categories, wherever it is rendered. A `user` picker offers people
 * rather than a content type, so it uses {@link CONTENT_USER_TARGET} - a token no
 * content type id can collide with.
 *
 * ## What each level buys
 *
 *     contentQueryRoot()                 everything, every content type
 *     contentTypeQueryRoot(type)         one content type, all of it
 *     contentListQueryRoot(type)         every page, sort, search of one list
 *     contentItemQueryRoot(type, item)   one record and everything under it
 *     contentOptionsQueryRoot(target)    every picker offering that target
 *
 * Each is a literal prefix of the ones below it, so nothing here ever needs
 * `queryClient.clear()`.
 */

/** The screen name this family lives under - `["vitnode","admin","content"]`. */
export const ADMIN_CONTENT_SCREEN = "content";

/**
 * The bucket a `user` picker's options sit in.
 *
 * People are not a content type, so a `user` field has no target content type
 * id. A token of its own rather than a fallback to the field name is what keeps
 * a content mutation from ever matching one: `CONTENT_ID_PATTERN` allows only
 * lowercase alphanumerics and dots, so no content type can be spelled with a
 * colon.
 */
export const CONTENT_USER_TARGET = "core:users";

/**
 * Everything the Content Engine caches.
 *
 * Rarely the right prefix to invalidate - a mutation knows which content type it
 * touched - but it is what a test asserts against to know the whole family
 * really does sit under the AdminCP root.
 */
export const contentQueryRoot = () => adminQueryRoot(ADMIN_CONTENT_SCREEN);

/** One content type's cache: its list, its records, and every picker onto it. */
export const contentTypeQueryRoot = (contentTypeId: string) =>
  [...contentQueryRoot(), contentTypeId] as const;

/**
 * Every page, sort, search and filter of one list.
 *
 * What a create, a delete or a publish invalidates: the rows changed, so every
 * other page of the same list is now wrong too, and an administrator reaches
 * those by pressing a button that reads from the cache.
 */
export const contentListQueryRoot = (contentTypeId: string) =>
  [...contentTypeQueryRoot(contentTypeId), "list"] as const;

/** One page of one list - the normalised request is the rest of the key. */
export const contentListQueryKey = (contentTypeId: string, params: object) =>
  [...contentListQueryRoot(contentTypeId), params] as const;

/**
 * One record, and everything hanging off it.
 *
 * The prefix a delete *removes* and an edit invalidates. Its children - the
 * translations, the revisions, the schedules, the delivery panel - are all facts
 * about this record, so a write that moves the record moves them too.
 */
export const contentItemQueryRoot = (contentTypeId: string, itemId: number) =>
  [...contentTypeQueryRoot(contentTypeId), "item", itemId] as const;

/** The record itself. */
export const contentItemQueryKey = contentItemQueryRoot;

/** Every translation of one record, values included. */
export const contentTranslationsQueryKey = (
  contentTypeId: string,
  itemId: number,
) => [...contentItemQueryRoot(contentTypeId, itemId), "translations"] as const;

/**
 * One record's revision history.
 *
 * A root rather than a key: the history panel pages, so the page request is
 * appended by whoever opens it - and a restore invalidates the whole family.
 */
export const contentHistoryQueryRoot = (
  contentTypeId: string,
  itemId: number,
) => [...contentItemQueryRoot(contentTypeId, itemId), "history"] as const;

/** One page of that history, or one revision, named by the request. */
export const contentHistoryQueryKey = (
  contentTypeId: string,
  itemId: number,
  request: object,
) => [...contentHistoryQueryRoot(contentTypeId, itemId), request] as const;

/** One record's publication schedules. */
export const contentSchedulesQueryKey = (
  contentTypeId: string,
  itemId: number,
) => [...contentItemQueryRoot(contentTypeId, itemId), "schedules"] as const;

/** One record's delivery state - its canonical path and URL history. */
export const contentDeliveryQueryKey = (
  contentTypeId: string,
  itemId: number,
) => [...contentItemQueryRoot(contentTypeId, itemId), "delivery"] as const;

/**
 * Every reference picker offering rows of one content type.
 *
 * Keyed by the **target** - what the picker offers - rather than by the form it
 * is rendered in, which is what lets a category mutation expire the article
 * form's category picker without either screen knowing the other exists.
 *
 * `target` is a content type id for a `relation` field and
 * {@link CONTENT_USER_TARGET} for a `user` one.
 */
export const contentOptionsQueryRoot = (target: string) =>
  [...contentTypeQueryRoot(target), "options"] as const;

/**
 * One picker's options, in one language.
 *
 * The field name stays on the end because two fields onto the same target can
 * still be searched independently, and the locale after it because a picker's
 * labels are read in the administrator's own language: a relation onto a
 * localized content type resolves its label through `core_languages_words`, so
 * the same category id reads "News" for one editor and "Aktualności" for
 * another.
 *
 * The **search term is not here**, and that is the one thing to know before
 * reaching for this key. `AutoFormCombobox` owns the search: it debounces it,
 * holds it in state and appends `{ search }` to whatever key it is handed. So
 * this is the prefix a picker caches *under*, not a whole entry - which is why
 * it is exact enough to invalidate with and not exact enough to read with.
 *
 * `lib/options-query.ts` is the door a field component uses, because that side
 * holds a {@link ContentFormFieldSpec} rather than a target id; it calls this
 * rather than spelling the key again. There is one shape and one place it is
 * written.
 */
export const contentOptionsQueryKey = (
  target: string,
  field: string,
  locale: string,
) => [...contentOptionsQueryRoot(target), field, locale] as const;
