// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * The user header's injection seam.
 *
 * This is the header slot with links, a session and a mutation in it - the three
 * things a shared component is most tempted to reach for - so it is the one
 * worth pinning by source. `UserHeaderContent` renders a *state* it was handed
 * and calls back for the sign-out; whoever holds the router and the query client
 * supplies both.
 *
 * The Next.js claim that used to sit above this - "reaches nothing from
 * `next/*`" from these two entry points - is now `next-boundary.test.ts`'s, made
 * over every file in the package rather than over the two a walk from here
 * happens to touch. The reachability check for `get-session-api` went with it:
 * that module no longer exists anywhere, and "renders a state rather than
 * reading a session" below is the same contract asserted against code that does.
 */
const SHARED_CONTENT = join(here, "user-header-content.tsx");

describe("the shared user header takes its framework parts as props", () => {
  const withoutComments = (path: string): string =>
    readFileSync(path, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

  const code = withoutComments(SHARED_CONTENT);

  it("takes its links as a component", () => {
    expect(code).toContain("LinkComponent");
  });

  it("asks for a sign-out callback rather than calling a mutation", () => {
    expect(code).toContain("onSignOut");
    expect(code).not.toContain("logOutMutationApi");
  });

  it("renders a state rather than reading a session", () => {
    expect(code).toContain("state: UserHeaderState;");
    expect(code).not.toContain("useQuery");
  });
});
