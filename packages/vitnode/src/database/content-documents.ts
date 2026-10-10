import { camelCase, customType, index, uniqueIndex } from "drizzle-orm/pg-core";

import { core_users } from "./users";

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

export const core_content_documents = camelCase.table.withRLS(
  "core_content_documents",
  t => ({
    id: t.serial().primaryKey(),
    contentTypeId: t.varchar({ length: 100 }).notNull(),
    itemId: t.integer().notNull(),
    field: t.varchar({ length: 100 }).notNull(),
    language: t.varchar({ length: 35 }).notNull().default(""),
    state: bytea().notNull(),
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
    index("core_content_documents_updated_at_idx").on(t.updatedAt),
    index("core_content_documents_updated_by_idx").on(t.updatedBy),
  ],
);

export type ContentDocumentRow = typeof core_content_documents.$inferSelect;
