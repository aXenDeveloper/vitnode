import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { normalizeNamespaceList } from "@/routing";

import type { IntlMessages } from "./runtime";

import {
  GLOBAL_NAMESPACE,
  intlQueryOptions,
  loadedIntlNamespaces,
  MAX_NAMESPACE_DEPTH,
  MAX_NAMESPACE_LENGTH,
  MAX_NAMESPACES,
  validateIntlInput,
} from "./query";
import { configureIntl, resetIntlRuntime } from "./runtime";

const fetched: { locale: string; namespaces: readonly string[] }[] = [];

beforeEach(() => {
  fetched.length = 0;

  configureIntl({
    // The real fetcher is a server function. This stand-in only records what
    // it was asked for, which is what the assertions below read back.
    fetchMessages: async input => {
      fetched.push(input);

      return await Promise.resolve({
        locale: input.locale,
        messages: {},
      } satisfies IntlMessages);
    },
    i18n: {
      defaultLocale: "en",
      locales: [
        { code: "en", name: "English" },
        { code: "pl", name: "Polski" },
      ],
    },
  });
});

afterEach(() => {
  resetIntlRuntime();
});

const fetchThrough = async (
  options: ReturnType<typeof intlQueryOptions>,
): Promise<IntlMessages> =>
  await new QueryClient({
    defaultOptions: { queries: { retry: false } },
  }).fetchQuery(options);

describe("the query key names the language", () => {
  it("carries the locale", () => {
    expect(intlQueryOptions({ locale: "pl" }).queryKey).toEqual([
      "vitnode",
      "intl",
      "pl",
      GLOBAL_NAMESPACE,
    ]);
  });

  it("gives two languages two entries", () => {
    expect(intlQueryOptions({ locale: "en" }).queryKey).not.toEqual(
      intlQueryOptions({ locale: "pl" }).queryKey,
    );
  });

  it("defaults to the one namespace every page needs", () => {
    expect(intlQueryOptions({ locale: "en" }).queryKey).toContain(
      GLOBAL_NAMESPACE,
    );
  });

  it("sorts and de-duplicates the namespaces", () => {
    // Without this, two callers asking for the same sets in different orders
    // hold two cache entries with identical bytes, fetched twice and
    // invalidated separately.
    expect(
      intlQueryOptions({
        locale: "en",
        namespaces: ["core.search", "core.global", "core.search"],
      }).queryKey,
    ).toEqual(["vitnode", "intl", "en", "core.global", "core.search"]);
  });

  it("orders the namespaces the way a plugin route tree does", () => {
    const declared = [
      "core.search",
      "Core.Global",
      "core.global",
      "core.files",
    ];

    expect(
      intlQueryOptions({ locale: "en", namespaces: declared }).queryKey,
    ).toEqual(["vitnode", "intl", "en", ...normalizeNamespaceList(declared)]);
  });

  it("orders them by code unit, so no environment can reorder the key", () => {
    // Mixed case is where a collator and a code-unit comparison part company:
    // `localeCompare` puts "core.global" before "Core.Global", code units put
    // the capital first. Only one of the two is the same answer everywhere.
    expect(
      intlQueryOptions({
        locale: "en",
        namespaces: ["core.global", "Core.Global"],
      }).queryKey,
    ).toEqual(["vitnode", "intl", "en", "Core.Global", "core.global"]);
  });

  it("asks the host's fetcher for exactly what the key says", async () => {
    await fetchThrough(
      intlQueryOptions({
        locale: "pl",
        namespaces: ["core.search", "core.global"],
      }),
    );

    expect(fetched).toEqual([
      { locale: "pl", namespaces: ["core.global", "core.search"] },
    ]);
  });

  it("never refetches on its own", () => {
    // A locale's messages change when the app is redeployed, not while it runs.
    expect(intlQueryOptions({ locale: "en" }).staleTime).toBe(Infinity);
  });
});

describe("what the server function will accept", () => {
  it("keeps a locale the app was configured with", () => {
    expect(
      validateIntlInput({ locale: "pl", namespaces: [GLOBAL_NAMESPACE] })
        .locale,
    ).toBe("pl");
  });

  it("falls back to the default locale rather than failing", () => {
    // A stale link to a language that has since been removed should still
    // render the page, not 500.
    expect(
      validateIntlInput({ locale: "xx", namespaces: [GLOBAL_NAMESPACE] })
        .locale,
    ).toBe("en");
  });

  it("normalises the namespaces it returns", () => {
    expect(
      validateIntlInput({
        locale: "en",
        namespaces: ["core.search", "core.global", "core.search"],
      }).namespaces,
    ).toEqual(["core.global", "core.search"]);
  });

  it.each([
    ["a non-object", "nope"],
    ["null", null],
    ["a missing locale", { namespaces: [] }],
    ["a non-string locale", { locale: 1, namespaces: [] }],
    ["a missing namespace list", { locale: "en" }],
    ["a non-array namespace list", { locale: "en", namespaces: "core.global" }],
  ])("refuses %s", (_name, input) => {
    expect(() => validateIntlInput(input)).toThrow();
  });

  it("refuses more namespaces than any page has ever needed", () => {
    expect(() =>
      validateIntlInput({
        locale: "en",
        namespaces: Array.from(
          { length: MAX_NAMESPACES + 1 },
          (_, index) => `core.n${index}`,
        ),
      }),
    ).toThrow(/At most/);
  });

  it.each([
    ["a non-string entry", [1]],
    ["an empty entry", [""]],
    ["a hole in a sparse array", Array.from({ length: 1 })],
    ["an empty segment", ["core..global"]],
    ["a leading dot", [".core"]],
    ["a trailing dot", ["core."]],
    ["too many segments", ["a.".repeat(MAX_NAMESPACE_DEPTH) + "b"]],
    ["an over-long entry", ["a".repeat(MAX_NAMESPACE_LENGTH + 1)]],
  ])("refuses %s", (_name, namespaces) => {
    expect(() => validateIntlInput({ locale: "en", namespaces })).toThrow();
  });

  it.each(["__proto__", "constructor", "prototype"])(
    "refuses the prototype-pollution segment %s",
    segment => {
      // Rejected rather than quietly dropped: a request asking for one of these
      // is not a request with a typo in it.
      expect(() =>
        validateIntlInput({ locale: "en", namespaces: [`core.${segment}`] }),
      ).toThrow(/forbidden segment/);
    },
  );

  it("says what was wrong without repeating what was sent", () => {
    // The value is attacker-controlled and the message ends up in a server log.
    const sent = "core.<script>alert(1)</script>";

    expect(() =>
      validateIntlInput({ locale: "en", namespaces: [sent] }),
    ).not.toThrow(); // shape is legal; the point is the message below

    expect(() =>
      validateIntlInput({ locale: "en", namespaces: [{ evil: sent }] }),
    ).toThrow("namespaces[0] must be a string.");
  });
});

describe("which namespace sets a client is holding", () => {
  const queryClient = () => new QueryClient();

  it("falls back to the global set when nothing has loaded", () => {
    // A switch made before anything is in the cache still warms the one set
    // every page needs.
    expect(loadedIntlNamespaces(queryClient(), "en")).toEqual([
      [GLOBAL_NAMESPACE],
    ]);
  });

  it("finds every set cached for that language", () => {
    const client = queryClient();

    client.setQueryData(intlQueryOptions({ locale: "en" }).queryKey, {
      locale: "en",
      messages: {},
    });
    client.setQueryData(
      intlQueryOptions({ locale: "en", namespaces: ["core.search"] }).queryKey,
      { locale: "en", messages: {} },
    );

    const sets = loadedIntlNamespaces(client, "en").sort((a, b) =>
      a[0].localeCompare(b[0]),
    );

    expect(sets).toEqual([[GLOBAL_NAMESPACE], ["core.search"]]);
  });

  it("ignores the sets cached for another language", () => {
    // The point of the locale being in the key: warming `pl` must not be told
    // to fetch whatever `en` happens to hold under a different partition.
    const client = queryClient();

    client.setQueryData(
      intlQueryOptions({ locale: "pl", namespaces: ["core.files"] }).queryKey,
      { locale: "pl", messages: {} },
    );

    expect(loadedIntlNamespaces(client, "en")).toEqual([[GLOBAL_NAMESPACE]]);
    expect(loadedIntlNamespaces(client, "pl")).toEqual([["core.files"]]);
  });
});

describe("using the runtime before an app configured it", () => {
  it("throws with the fix in the message", async () => {
    resetIntlRuntime();

    // Not on building the options - the key is pure and a route may well
    // describe a query before anything runs. The read happens where the answer
    // is actually needed, which is the fetch and the input boundary.
    await expect(
      fetchThrough(intlQueryOptions({ locale: "en" })),
    ).rejects.toThrow(/configureIntl/);
    expect(() => validateIntlInput({ locale: "en", namespaces: [] })).toThrow(
      /configureIntl/,
    );
  });
});
