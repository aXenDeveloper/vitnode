// No "use client": reached only from `content-form`, which is itself only
// reached from a client entry. Declaring it again would make this a nested
// client entry, which `next/dynamic` cannot resolve from inside a package.
import React from "react";

import type {
  ContentMutationResult,
  ContentRowResult,
  ContentTranslationInput,
  TranslationRow,
} from "../content-mutation";
import type { ContentOption } from "../lib/field-component";

/**
 * Every call a Content Engine form makes, and nothing else.
 *
 * The one seam between the form and the framework it is rendered by. Everything
 * else about a content form is already portable - the spec is generated from the
 * definition, the schema from the spec, the payload from the values, the toast
 * from the result - and it was *these eight calls*, all of them Next.js Server
 * Actions, that made the whole stack Next-only.
 *
 *     Next.js AdminCP          this interface          TanStack Start AdminCP
 *     -----------------------------------------------------------------------
 *     "use server" actions  →   create/edit/…    ←   fetch → Hono → invalidate
 *     revalidatePath()          (the form)           queryClient.invalidate…
 *
 * ## Why the cache work lives behind the seam rather than in the form
 *
 * Both hosts have to make the screen reflect a write, and neither does it the
 * way the other does: Next.js expires a cached route segment from the server,
 * during the action, before it answers; TanStack Start drops query entries in
 * the browser after the response. Neither is expressible in the other's terms,
 * and a form that tried to own both would end up holding a `revalidatePath` it
 * cannot call and a `QueryClient` the server action does not have. So each
 * implementation does its own, and the form's job ends at reading the result.
 *
 * ## Why it is a context and not a module-level registration
 *
 * `setAdminTransport` is a module-level slot because the value it holds - one
 * server function - is the same for every visitor and every request. This one is
 * not: the TanStack implementation closes over the request's `QueryClient`,
 * which is per-render and must never be shared between two visitors being
 * server-rendered at the same time. React context is the only place a
 * per-request value can live safely.
 *
 * ## What is deliberately *not* here
 *
 * The file upload. It is `multipart/form-data` straight to the generated route
 * and always has been - see `content/admin/upload.ts` - so it is already the
 * same code in both hosts and has no seam to cross. Pulling it in here would
 * mean a `File` passing through a transport whose other members are JSON, which
 * is exactly the mistake that arrangement exists to avoid.
 */
export interface ContentFormTransport {
  /** Creates a record from the shared fields alone. */
  create: (
    contentTypeId: string,
    values: Record<string, unknown>,
  ) => Promise<ContentMutationResult>;
  /**
   * Creates a record **and** its translations, in one transaction.
   *
   * One call rather than a create followed by N translation writes, because the
   * engine's invariant is that a record exists in at least its default language
   * or it does not exist at all - and N writes that can each fail on their own
   * cannot hold that.
   */
  createLocalized: (
    contentTypeId: string,
    values: Record<string, unknown>,
    translations: ContentTranslationInput[],
  ) => Promise<ContentMutationResult>;
  /**
   * Saves the shared fields of one record.
   *
   * `expectedVersion` is the version the editor started from. Required by an
   * editorial content type and ignored by every other one, so the form passes it
   * unconditionally.
   */
  edit: (
    contentTypeId: string,
    itemId: number,
    values: Record<string, unknown>,
    expectedVersion?: number,
  ) => Promise<ContentMutationResult>;
  /**
   * Saves the shared fields and every changed language, in one transaction.
   *
   * `values` is `undefined` when no shared field moved, and a language appears
   * only when something in it moved - so a Polish-only edit bumps the Polish
   * version and nothing else. Each entry carries the version it was loaded at,
   * so two translators in two languages never contend and a stale one is refused
   * for that language *before anything commits*.
   */
  editLocalized: (
    contentTypeId: string,
    itemId: number,
    values: Record<string, unknown> | undefined,
    translations: ContentTranslationInput[],
    expectedVersion?: number,
  ) => Promise<ContentMutationResult>;
  /**
   * Every language one record exists in, values included, in **one** request.
   *
   * What a localized form opens on. Its localized inputs each carry their own
   * language switcher, so they need the whole set up front - reading it language
   * by language would be one round trip per language to open one record.
   */
  listTranslations: (
    contentTypeId: string,
    itemId: number,
  ) => Promise<{ edges: TranslationRow[]; error?: string }>;
  /**
   * Backs the `relation` and `user` pickers.
   *
   * Gated by the content type's own `can_view` rather than by a permission on
   * the target table, which is the reason a `user` field reads its people from
   * here rather than from the members list: an editor who may write articles can
   * pick an author without also being trusted to browse the member list.
   *
   * `ids` labels exactly those identifiers instead of searching - how a to-many
   * picker turns the ids a form opened with into names, since there is no label
   * on the row for a set.
   */
  loadOptions: (
    contentTypeId: string,
    field: string,
    search: string,
    ids?: number[],
  ) => Promise<ContentOption[]>;
  /** Moves a record to `published`. Idempotent: a no-op is a success. */
  publish: (
    contentTypeId: string,
    itemId: number,
  ) => Promise<ContentMutationResult>;
  /**
   * Re-reads one record, for the conflict banner and for the collection fields
   * a list row does not carry.
   *
   * Deliberately not a page refresh: the form is open with the editor's unsaved
   * values in it, and remounting it would throw them away - which is the one
   * thing the conflict flow must not do.
   */
  reloadRow: (
    contentTypeId: string,
    itemId: number,
  ) => Promise<ContentRowResult>;
  /** Moves a record back to `draft`. Idempotent, like {@link publish}. */
  unpublish: (
    contentTypeId: string,
    itemId: number,
  ) => Promise<ContentMutationResult>;
}

const ContentFormTransportContext =
  React.createContext<ContentFormTransport | null>(null);

export const ContentFormTransportProvider = ({
  children,
  value,
}: {
  children: React.ReactNode;
  value: ContentFormTransport;
}) => (
  <ContentFormTransportContext.Provider value={value}>
    {children}
  </ContentFormTransportContext.Provider>
);

/**
 * The message a caller gets when a host forgot to mount the provider.
 *
 * A named constant so a test can assert on it without matching English, and so
 * the sentence says what to do rather than what went wrong.
 */
export const CONTENT_FORM_TRANSPORT_MISSING =
  "A Content Engine form must be rendered inside a ContentFormTransportProvider. Next.js mounts one in NextContentFormHost; a TanStack Start route mounts one in ContentFormHost.";

export const useContentFormTransport = (): ContentFormTransport => {
  const transport = React.use(ContentFormTransportContext);

  if (!transport) throw new Error(CONTENT_FORM_TRANSPORT_MISSING);

  return transport;
};
