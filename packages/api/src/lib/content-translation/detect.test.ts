import { describe, expect, it } from "vitest";

import { detectLanguage, primaryLocale } from "./detect";

describe("detectLanguage", () => {
  it.each([
    ["Dzień dobry", { confident: true, locale: "pl" }],
    ["Great idea!", { confident: true, locale: "en" }],
    [
      "The update broke the login page for everyone on mobile, please fix it",
      { confident: true, locale: "en" },
    ],
    [
      "Po aktualizacji nie mogę się zalogować na telefonie, czy ktoś wie co jest nie tak?",
      { confident: true, locale: "pl" },
    ],
  ])("is confident about %j", (text, expected) => {
    expect(detectLanguage(text)).toEqual(expected);
  });

  it.each(["Kubernetes", "🎉 https://example.com @anna", ""])(
    "is not confident about %j",
    text => {
      expect(detectLanguage(text).confident).toBe(false);
    },
  );
});

describe("primaryLocale", () => {
  it.each([
    ["pt-BR", "pt"],
    ["EN", "en"],
    ["pl", "pl"],
  ])("%s → %s", (locale, primary) => {
    expect(primaryLocale(locale)).toBe(primary);
  });
});
