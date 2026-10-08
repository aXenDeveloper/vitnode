// @vitest-environment node
import type { Context } from "hono";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";

import type { ContentLiveDocRef } from "@/content/live/protocol";

import { core_content_documents } from "@/database/content-documents";
import { core_files } from "@/database/files";
import { core_languages } from "@/database/languages";
import { core_roles } from "@/database/roles";
import { core_users } from "@/database/users";
import {
  createTestDatabase,
  describePostgres,
  type TestDatabaseHandle,
} from "@/tests/postgres";

import {
  cleanupStaleContentDocuments,
  CONTENT_DOCUMENT_SEED_CLAIM_MS,
  createContentDocumentStore,
} from "./document-store";

const doc: ContentLiveDocRef = {
  contentTypeId: "test.guide",
  field: "content",
  itemId: 1,
  locale: "en",
};
const shared: ContentLiveDocRef = { ...doc, field: "intro", locale: null };
const otherRecord: ContentLiveDocRef = { ...doc, itemId: 2 };

describePostgres("the content document store", () => {
  let database: TestDatabaseHandle;
  let c: Context;

  beforeAll(async () => {
    // The documents table references users, which reference these.
    database = await createTestDatabase({
      core_content_documents,
      core_files,
      core_languages,
      core_roles,
      core_users,
    });
    c = {
      get: (key: string) => (key === "db" ? database.db : undefined),
    } as unknown as Context;
  });

  afterAll(async () => {
    await database?.drop();
  });

  beforeEach(async () => {
    await database.db.delete(core_content_documents);
  });

  it("round-trips a state, per language and for a shared field", async () => {
    const store = createContentDocumentStore(c);

    await store.save(doc, new Uint8Array([1, 2, 3]), {
      baseVersion: 4,
      userId: null,
    });
    await store.save(shared, new Uint8Array([9]), {
      baseVersion: null,
      userId: null,
    });

    expect(await store.load(doc)).toEqual(new Uint8Array([1, 2, 3]));
    expect(await store.load(shared)).toEqual(new Uint8Array([9]));
    expect(await store.load({ ...doc, locale: "pl" })).toBeNull();

    await store.save(doc, new Uint8Array([7]), {
      baseVersion: 5,
      userId: null,
    });

    expect(await store.load(doc)).toEqual(new Uint8Array([7]));
  });

  it("lets exactly one of two openers claim the seed", async () => {
    const first = createContentDocumentStore(c);
    const second = createContentDocumentStore(c);

    const claims = await Promise.all([
      first.claimSeed(doc),
      second.claimSeed(doc),
    ]);

    expect(claims.filter(Boolean)).toHaveLength(1);
    // A claim is not a state.
    expect(await first.load(doc)).toBeNull();
  });

  it("takes over a stale claim, but never a seeded document", async () => {
    const store = createContentDocumentStore(c);
    await store.claimSeed(doc);
    await database.db.update(core_content_documents).set({
      updatedAt: new Date(Date.now() - CONTENT_DOCUMENT_SEED_CLAIM_MS - 1),
    });

    expect(await store.claimSeed(doc)).toBe(true);

    await store.save(doc, new Uint8Array([1]), {
      baseVersion: 1,
      userId: null,
    });
    await database.db
      .update(core_content_documents)
      .set({ updatedAt: new Date(0) });

    expect(await store.claimSeed(doc)).toBe(false);
  });

  it("releases only an unseeded claim", async () => {
    const store = createContentDocumentStore(c);
    await store.claimSeed(doc);
    await store.save(shared, new Uint8Array([1]), {
      baseVersion: 1,
      userId: null,
    });

    await store.releaseSeed(doc);
    await store.releaseSeed(shared);

    expect(await store.claimSeed(doc)).toBe(true);
    expect(await store.load(shared)).toEqual(new Uint8Array([1]));
  });

  it("deletes one record's documents", async () => {
    const store = createContentDocumentStore(c);
    const meta = { baseVersion: 1, userId: null };
    await store.save(doc, new Uint8Array([1]), meta);
    await store.save(shared, new Uint8Array([1]), meta);
    await store.save(otherRecord, new Uint8Array([1]), meta);

    await store.deleteRecord(doc);

    expect(await store.load(doc)).toBeNull();
    expect(await store.load(shared)).toBeNull();
    expect(await store.load(otherRecord)).toEqual(new Uint8Array([1]));
  });

  it("cleans up documents untouched for 30 days", async () => {
    const store = createContentDocumentStore(c);
    const meta = { baseVersion: 1, userId: null };
    await store.save(doc, new Uint8Array([1]), meta);
    await store.save(otherRecord, new Uint8Array([1]), meta);
    const now = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000 + 1_000);
    await store.save(shared, new Uint8Array([1]), meta);
    await database.db
      .update(core_content_documents)
      .set({ updatedAt: now })
      .where(eq(core_content_documents.field, "intro"));

    expect(await cleanupStaleContentDocuments(c, { now })).toBe(2);
    expect(await store.load(shared)).toEqual(new Uint8Array([1]));
  });
});
