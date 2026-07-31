import { describe, expect, it } from "vitest";

import { MAX_SEARCH_RESULTS } from "./constants";
import { splitResultBudget } from "./split-results";

const split = (navCount: number, usersCount: number) =>
  splitResultBudget({ budget: MAX_SEARCH_RESULTS, navCount, usersCount });

const total = (share: { nav: number; users: number }) =>
  share.nav + share.users;

describe("splitResultBudget", () => {
  it("never renders more rows than the budget", () => {
    for (const navCount of [0, 1, 5, 9, 10, 13, 40]) {
      for (const usersCount of [0, 1, 5, 9, 10]) {
        const share = split(navCount, usersCount);

        expect(total(share)).toBeLessThanOrEqual(MAX_SEARCH_RESULTS);
        expect(share.nav).toBeLessThanOrEqual(navCount);
        expect(share.users).toBeLessThanOrEqual(usersCount);
      }
    }
  });

  it("gives the whole budget to pages when there are no users", () => {
    expect(split(13, 0)).toStrictEqual({ nav: 10, users: 0 });
  });

  it("gives the whole budget to users when no page matches", () => {
    // Searching a person's name rarely matches a page - showing only five
    // users there would waste half the palette.
    expect(split(0, 10)).toStrictEqual({ nav: 0, users: 10 });
  });

  it("splits evenly when both sides are plentiful", () => {
    expect(split(13, 10)).toStrictEqual({ nav: 5, users: 5 });
  });

  it("hands unused rows to the other side", () => {
    expect(split(13, 2)).toStrictEqual({ nav: 8, users: 2 });
    expect(split(2, 10)).toStrictEqual({ nav: 2, users: 8 });
  });

  it("shows everything when the total already fits", () => {
    expect(split(4, 3)).toStrictEqual({ nav: 4, users: 3 });
    expect(split(0, 0)).toStrictEqual({ nav: 0, users: 0 });
  });

  it("fills the budget whenever enough results exist", () => {
    for (const [navCount, usersCount] of [
      [10, 10],
      [6, 6],
      [20, 1],
      [1, 20],
    ]) {
      expect(total(split(navCount, usersCount))).toBe(MAX_SEARCH_RESULTS);
    }
  });
});
