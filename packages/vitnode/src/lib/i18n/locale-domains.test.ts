import { describe, expect, it } from "vitest";

import type { LocaleDomainConfig } from "./types";

import { normalizeHost, resolveLocaleDomains } from "./locale-domains";

const resolve = (
  domains: LocaleDomainConfig[],
  localePrefix: "always" | "as-needed" | "never" = "as-needed",
) => resolveLocaleDomains({ domains, localePrefix, locales: ["en", "pl"] });

describe("normalizeHost", () => {
  it.each([
    ["vitnode.pl", "vitnode.pl"],
    ["VitNode.PL", "vitnode.pl"],
    ["vitnode.pl.", "vitnode.pl"],
    ["vitnode.pl:443", "vitnode.pl"],
    ["localhost:3000", "localhost:3000"],
    ["vitnode.pl, proxy.internal", "vitnode.pl"],
  ])("reads %s as %s", (input, expected) => {
    expect(normalizeHost(input)).toBe(expected);
  });

  it.each([
    [undefined],
    [""],
    ["evil.com/path"],
    ["user@vitnode.pl"],
    ["vitnode.pl\\evil"],
    ["vitnode pl"],
    ["vitnode.pl:port"],
    ["a".repeat(300)],
  ])("rejects %s", input => {
    expect(normalizeHost(input)).toBeUndefined();
  });
});

describe("resolveLocaleDomains", () => {
  it("resolves one locale per origin", () => {
    expect(
      resolve([
        { defaultLocale: "en", origin: "https://vitnode.com" },
        { defaultLocale: "pl", origin: "https://VitNode.pl/" },
      ]),
    ).toEqual([
      {
        defaultLocale: "en",
        host: "vitnode.com",
        locales: ["en"],
        origin: "https://vitnode.com",
      },
      {
        defaultLocale: "pl",
        host: "vitnode.pl",
        locales: ["pl"],
        origin: "https://vitnode.pl",
      },
    ]);
  });

  it.each([
    ["a path", "https://vitnode.pl/pl"],
    ["a query", "https://vitnode.pl?x=1"],
    ["credentials", "https://user:pass@vitnode.pl"],
    ["another scheme", "ftp://vitnode.pl"],
    ["no scheme", "vitnode.pl"],
  ])("rejects an origin with %s", (_, origin) => {
    expect(() =>
      resolve([
        { defaultLocale: "en", origin: "https://vitnode.com" },
        { defaultLocale: "pl", origin },
      ]),
    ).toThrow(expect.objectContaining({ code: "invalid-domain" }));
  });

  it("rejects one host listed twice", () => {
    expect(() =>
      resolve([
        { defaultLocale: "en", origin: "https://vitnode.com" },
        { defaultLocale: "pl", origin: "http://vitnode.com" },
      ]),
    ).toThrow(expect.objectContaining({ code: "duplicate-domain" }));
  });

  it("rejects a locale assigned to two hosts", () => {
    expect(() =>
      resolve([
        {
          defaultLocale: "en",
          locales: ["en", "pl"],
          origin: "https://vitnode.com",
        },
        { defaultLocale: "pl", origin: "https://vitnode.pl" },
      ]),
    ).toThrow(
      expect.objectContaining({
        code: "domain-locale-conflict",
        conflictsWith: "https://vitnode.com",
        locale: "pl",
      }),
    );
  });

  it("rejects a locale without a home once domains are configured", () => {
    expect(() =>
      resolve([{ defaultLocale: "pl", origin: "https://vitnode.pl" }]),
    ).toThrow(
      expect.objectContaining({ code: "unassigned-locale", locale: "en" }),
    );
  });

  it("rejects a locale the app does not enable", () => {
    expect(() =>
      resolve([
        { defaultLocale: "en", origin: "https://vitnode.com" },
        {
          defaultLocale: "pl",
          locales: ["pl", "de"],
          origin: "https://vitnode.pl",
        },
      ]),
    ).toThrow(
      expect.objectContaining({ code: "unknown-domain-locale", locale: "de" }),
    );
  });

  it('rejects a host serving two locales under localePrefix "never"', () => {
    expect(() =>
      resolve(
        [
          {
            defaultLocale: "en",
            locales: ["en", "pl"],
            origin: "https://vitnode.com",
          },
        ],
        "never",
      ),
    ).toThrow(expect.objectContaining({ code: "ambiguous-never-prefix" }));
  });

  it("allows a host serving several locales with a prefix", () => {
    expect(() =>
      resolve([
        {
          defaultLocale: "en",
          locales: ["en", "pl"],
          origin: "https://vitnode.com",
        },
      ]),
    ).not.toThrow();
  });
});
