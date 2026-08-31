import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * There is one permission state, and one place it comes from.
 *
 * A source scan rather than a render, which is the only way to assert this at
 * all: the failure being prevented is a *second* context or a *second* cache
 * being introduced, and a rendering test proves nothing about a store nobody
 * mounted in it. What this pins is the shape of the bridge -
 *
 *     Hono /admin/session -> ["vitnode","admin-session"] -> the existing context
 *
 * - and specifically that the middle arrow is the only way to reach the right
 * hand side.
 */

const here = dirname(fileURLToPath(import.meta.url));

const withoutComments = (code: string): string =>
  code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const sourcesUnder = (directory: string): { code: string; name: string }[] =>
  readdirSync(directory)
    .filter(name => statSync(join(directory, name)).isFile())
    .filter(name => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name))
    .map(name => ({
      code: withoutComments(readFileSync(join(directory, name), "utf8")),
      name,
    }));

const adminSources = () => sourcesUnder(here);

/**
 * One module by name, or a failure that says which one is missing.
 *
 * A lookup rather than a non-null assertion, so renaming a module fails these
 * tests with its name in the message instead of with a property read on
 * `undefined` several lines later.
 */
const sourceNamed = (name: string): string => {
  const source = adminSources().find(entry => entry.name === name);

  if (!source) throw new Error(`tanstack/admin/${name} is missing`);

  return source.code;
};

describe("this test is looking at the right tree", () => {
  it("finds the feature's modules", () => {
    expect(adminSources().map(({ name }) => name)).toContain("permissions.tsx");
  });

  it("still sees the code under the comments", () => {
    // The control for the comment stripping: a scan that blanked whole files
    // would satisfy every "found nothing" assertion below.
    expect(
      adminSources().filter(({ code }) =>
        code.includes("adminSessionQueryOptions"),
      ),
    ).not.toEqual([]);
  });
});

describe("the permission UI is a bridge, not a second store", () => {
  const permissions = () => sourceNamed("permissions.tsx");

  it("mounts the AdminCP's existing permission context", () => {
    // The same context the Next.js AdminCP mounts, so every screen already
    // written against `AdminStaffPermissionGate` keeps working as it migrates
    // and there is never a moment when two states exist and can disagree.
    expect(permissions()).toMatch(
      /from\s+"@\/components\/staff-permission\/provider"/,
    );
    expect(permissions()).toMatch(/AdminStaffPermissionProvider/);
  });

  it("fills it from the canonical query and from nothing else", () => {
    expect(permissions()).toMatch(/adminSessionQueryOptions/);
  });

  it("takes no permission set as a prop", () => {
    // What makes it a bridge rather than a store: there is no way to mount it
    // with a set that did not come from the API.
    expect(permissions()).not.toMatch(/permissions\s*[,}:]\s*.*\bprops\b/);
    expect(permissions()).not.toMatch(/value=\{\s*permissions\s*\}/);
  });
});

describe("nothing in the feature creates a second source of truth", () => {
  /**
   * Contexts as such are fine - the shell has one for the navigation model, and
   * a context holding derived render data is not a store. What must not exist is
   * a *second* context holding the admin session, the administrator or their
   * permissions, because that is a value that can disagree with the query.
   */
  it("declares no context of its own for the session or its permissions", () => {
    const declaredContexts = ({ code }: { code: string }): string[] =>
      [
        ...code.matchAll(
          /(?:const|let|var)\s+(\w+)\s*(?::[^=]+)?=\s*(?:React\.)?createContext\s*[(<]/g,
        ),
      ].map(match => match[1]);

    const offenders = adminSources()
      .flatMap(source =>
        declaredContexts(source)
          .filter(name => /permission|session|access|staff/i.test(name))
          .map(name => `${source.name}: ${name}`),
      )
      .sort((a, b) => a.localeCompare(b));

    expect(offenders).toEqual([]);
  });

  it("finds the contexts that do exist, so the scan is real", () => {
    // The control. A regex that matched nothing would satisfy the assertion
    // above whatever anybody wrote.
    expect(
      adminSources().filter(({ code }) => /createContext\s*[(<]/.test(code)),
    ).not.toEqual([]);
  });

  it("creates no QueryClient of its own", () => {
    // The host owns exactly one, per server request and per browser. A second
    // one here would be a cache a loader fills and no component can see.
    const offenders = adminSources()
      .filter(({ code }) => /new\s+QueryClient\s*\(/.test(code))
      .map(({ name }) => name);

    expect(offenders).toEqual([]);
  });

  /**
   * The one that would be catastrophic on a server rendering several
   * administrators at once. `./transport` holds a module-level value on purpose
   * - a function reference, identical for every request - and it is the only
   * module allowed to.
   */
  it("holds no module-level mutable state outside the transport registry", () => {
    const offenders = adminSources()
      .filter(({ name }) => name !== "transport.ts")
      .filter(({ code }) => /^\s*let\s+\w+/m.test(code))
      .map(({ name }) => name);

    expect(offenders).toEqual([]);
  });

  it("stores no session, user or permission set at module scope", () => {
    const offenders = adminSources()
      .filter(({ code }) =>
        /^\s*(let|var)\s+(session|user|admin|permissions)\b/m.test(code),
      )
      .map(({ name }) => name);

    expect(offenders).toEqual([]);
  });
});

describe("the query key is spelled once", () => {
  /**
   * Two spellings of the same key are two cache entries: the one a guard filled
   * would not be the one the sidebar renders from, and a removal would clear
   * only one of them.
   */
  it("is never written out as a literal outside ./state", () => {
    const offenders = adminSources()
      .filter(({ name }) => name !== "state.ts")
      .filter(({ code }) => /["']admin-session["']/.test(code))
      .map(({ name }) => name);

    expect(offenders).toEqual([]);
  });
});

describe("the admin session is never read through the public one", () => {
  /**
   * `AuthState.isAdmin` lives on the *public* session and means "may be offered
   * the AdminCP", not "is inside it". They are two cookies. A module here
   * reaching for the public session query would be one answering an admin
   * question with a public answer.
   */
  it("no module reads the public session query", () => {
    const offenders = adminSources()
      .filter(({ code }) =>
        /\bsessionQueryOptions\b|\bensureAuthState\b|\bSESSION_QUERY_KEY\b/.test(
          code,
        ),
      )
      .map(({ name }) => name);

    expect(offenders).toEqual([]);
  });

  it("reuses the shared auth transport for the sign-in mutation, though", () => {
    // The other half of the boundary, and the reason the assertion above is
    // about the *session* rather than about `tanstack/auth` wholesale: there is
    // one sign-in endpoint and one transport, and `isAdmin` is the only
    // difference. A second auth transport would be the duplication to avoid.
    const actions = sourceNamed("actions.ts");

    expect(actions).toMatch(/authTransport\(\)\.signIn/);
    expect(actions).toMatch(/isAdmin:\s*true/);
  });
});
