import { describe, expect, it } from "vitest";

import type { AdminTransport } from "./transport";

import {
  ADMIN_TRANSPORT_MISSING,
  adminTransport,
  hasAdminTransport,
  setAdminTransport,
} from "./transport";

/**
 * The admin seam's registration lifecycle, including the one a dev server puts
 * it through.
 *
 * A whole file to itself for the same reason `../auth/transport.test.ts` is: the
 * unregistered state exists exactly once per module instance, and a file that
 * registers can never observe it again. Vitest isolates modules per file, so
 * this is the only place the "before" half can be asserted at all.
 *
 * ## Why replacement is a behaviour and not an accident
 *
 * Module scope means *per bundle*, and a bundle is re-evaluated more often than
 * a deployment: a hot reload of the host's `lib/admin-auth.ts` runs
 * `setAdminTransport` again with a *new* function that closes over the new
 * module. Refusing that - a "already registered" throw, which is the reflex for
 * a singleton - would turn every save of that file into a build error the author
 * can only clear by restarting the server. Accepting it and keeping the *first*
 * function is worse: the registry then holds a closure over a module that no
 * longer exists, so the screen renders from code the editor no longer shows.
 *
 * Last write wins, and the read happens at call time. Those two together are the
 * whole of what makes this HMR-safe, and they are what the transitions below
 * pin.
 */

/**
 * A transport carrying a tag, so "which registration answered" is a question
 * about identity rather than about behaviour.
 *
 * The read resolves to `network_error`, which is a real member of
 * `AdminSessionReadResult`: nothing below calls it, and a transport that could
 * not be constructed without inventing a session shape would be asserting
 * against its own fiction.
 */
type TaggedTransport = AdminTransport & { readonly tag: string };

const transportOf = (tag: string): TaggedTransport => ({
  readAdminSession: async () => Promise.resolve({ status: "network_error" }),
  tag,
});

const tagOf = (transport: AdminTransport): string =>
  (transport as TaggedTransport).tag;

describe("first registration", () => {
  it("has nothing registered before the host loads its module", () => {
    expect(hasAdminTransport()).toBe(false);
  });

  it("says what is missing and what to call, rather than answering undefined", () => {
    expect(() => adminTransport()).toThrow(ADMIN_TRANSPORT_MISSING);
    expect(ADMIN_TRANSPORT_MISSING).toContain("setAdminTransport()");
  });

  it("hands back exactly what was registered", () => {
    const first = transportOf("first");

    setAdminTransport(first);

    expect(hasAdminTransport()).toBe(true);
    expect(adminTransport()).toBe(first);
  });
});

describe("the same registration repeated", () => {
  it("is not an error, and changes nothing", () => {
    const same = transportOf("same");

    setAdminTransport(same);
    setAdminTransport(same);

    expect(adminTransport()).toBe(same);
  });
});

describe("a new registration after a hot reload", () => {
  /**
   * The replacement module provides a *different* function object, which is the
   * normal case rather than the exceptional one: a re-evaluated module builds a
   * new closure even when its source did not change.
   */
  it("accepts a legitimate replacement rather than throwing", () => {
    setAdminTransport(transportOf("before"));

    expect(() => {
      setAdminTransport(transportOf("after"));
    }).not.toThrow();
  });

  it("answers with the newer function, not the one it replaced", () => {
    const before = transportOf("before");
    const after = transportOf("after");

    setAdminTransport(before);
    setAdminTransport(after);

    expect(adminTransport()).toBe(after);
    expect(tagOf(adminTransport())).toBe("after");
  });

  /**
   * The stale-closure question, asked the only way it can be asked of a
   * module-scope registry: does a caller that resolved *before* the replacement
   * still reach the old value afterwards?
   *
   * It cannot, because nothing captures the registry - `adminTransport()` reads
   * the slot on every call. A consumer that had written `const t =
   * adminTransport()` at module scope would hold the old one, which is why no
   * consumer does; `../../framework` and this namespace call it at use.
   */
  it("leaves no caller holding the previous registration", () => {
    const before = transportOf("before");

    setAdminTransport(before);

    // A consumer that reads at call time, as every one in this package does.
    const readNow = () => adminTransport();

    expect(readNow()).toBe(before);

    const after = transportOf("after");

    setAdminTransport(after);

    expect(readNow()).toBe(after);
  });

  it("survives any number of replacements, holding only the last", () => {
    const registrations = ["a", "b", "c", "d"].map(transportOf);

    registrations.forEach(setAdminTransport);

    expect(adminTransport()).toBe(registrations.at(-1));
  });
});

describe("what the registry is not", () => {
  /**
   * Worth pinning rather than left to the doc comment: this holds a function
   * reference, which is the same for every visitor and every request. That is
   * the entire argument for a module-level value on a server rendering many
   * administrators at once - a registry that held a session, an administrator or
   * a permission set would leak one visitor's answer into another's page.
   */
  it("holds only what was handed to it, with no state of its own", () => {
    const transport = transportOf("only");

    setAdminTransport(transport);

    expect(Object.keys(adminTransport())).toEqual(Object.keys(transport));
    expect(adminTransport()).toBe(transport);
  });
});
