import { camelCase, customType, index, uniqueIndex } from "drizzle-orm/pg-core";

import { core_users } from "./users";

/** Raw bytes. Drizzle ships no `bytea` column, so it is declared once here. */
const bytea = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
  fromDriver(value) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  },
  toDriver(value) {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  },
});

/**
 * The collaborative state (a Yjs update) of one rich text field of one record
 * in one language: the working copy editors type into together. The record
 * itself only changes on Save.
 */
export const core_content_documents = camelCase.table.withRLS(
  "core_content_documents",
  t => ({
    id: t.serial().primaryKey(),
    contentTypeId: t.varchar({ length: 100 }).notNull(),
    itemId: t.integer().notNull(),
    field: t.varchar({ length: 100 }).notNull(),
    /** The locale, or `""` for a field that is not localized. */
    language: t.varchar({ length: 35 }).notNull().default(""),
    /**
     * The merged Yjs state. Empty while a seeder is filling a new document, so
     * every instance can tell "being seeded" from "never opened".
     */
    state: bytea().notNull(),
    /** The record's version when the document was last written. */
    baseVersion: t.integer(),
    updatedAt: t.timestamp().notNull().defaultNow(),
    updatedBy: t.integer().references(() => core_users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
  }),
  t => [
    uniqueIndex("core_content_documents_doc_unique").on(
      t.contentTypeId,
      t.itemId,
      t.field,
      t.language,
    ),
    // The stale-document cleanup scans by age.
    index("core_content_documents_updated_at_idx").on(t.updatedAt),
    // Postgres does not index the child side of a foreign key on its own, and
    // `ON DELETE SET NULL` scans it on every user deletion.
    index("core_content_documents_updated_by_idx").on(t.updatedBy),
  ],
);

export type ContentDocumentRow = typeof core_content_documents.$inferSelect;
