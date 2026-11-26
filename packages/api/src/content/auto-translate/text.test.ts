import { describe, expect, it } from "vitest";

import {
  classifyTranslatableText,
  protectTokens,
  restoreProtectedTokens,
} from "./text";

describe("classifyTranslatableText", () => {
  it.each([
    ["", "hard_skip", "no_text"],
    ["   ", "hard_skip", "no_text"],
    ["🎉🔥 👍🏽", "hard_skip", "no_text"],
    [":tada: :+1:", "hard_skip", "no_text"],
    ["https://example.com/some/long-path?q=1", "hard_skip", "no_text"],
    ["@john_doe", "hard_skip", "no_text"],
    ["+1", "hard_skip", "no_text"],
    ["OK!", "hard_skip", "acknowledgment"],
    ["lol", "hard_skip", "acknowledgment"],
    ["Thank you 🙏", "hard_skip", "acknowledgment"],
    ["@anna thanks!", "hard_skip", "acknowledgment"],
    ["hahaha", "hard_skip", "acknowledgment"],
    ["xDDD", "hard_skip", "acknowledgment"],
    ["Dzięki!", "hard_skip", "acknowledgment"],
    ["Kubernetes", "soft_skip", "single_word"],
    ["Kubernetes https://k8s.io", "soft_skip", "single_word"],
    ["OK, the update broke login", "translatable", undefined],
    ["Dzień dobry", "translatable", undefined],
  ])("%j is %s", (text, kind, reason) => {
    const result = classifyTranslatableText(text);

    expect(result.kind).toBe(kind);
    expect("reason" in result ? result.reason : undefined).toBe(reason);
  });
});

describe("protected tokens", () => {
  const source =
    "Ask @anna about `npm run build` at https://example.com/help today";

  it("swaps URLs, mentions and inline code for placeholders and restores them", () => {
    const { text, tokens } = protectTokens(source);

    expect(text).toBe("Ask ⟦1⟧ about ⟦2⟧ at ⟦3⟧ today");
    expect(
      restoreProtectedTokens("Zapytaj ⟦1⟧ o ⟦2⟧ na ⟦3⟧ dziś", tokens),
    ).toBe("Zapytaj @anna o `npm run build` na https://example.com/help dziś");
    // Order may change in translation.
    expect(restoreProtectedTokens("⟦3⟧ ⟦1⟧ ⟦2⟧", tokens)).toBe(
      "https://example.com/help @anna `npm run build`",
    );
  });

  it.each([
    ["a lost placeholder", "Zapytaj ⟦1⟧ o ⟦2⟧ dziś"],
    ["a repeated placeholder", "⟦1⟧ ⟦1⟧ ⟦2⟧ ⟦3⟧"],
    ["an invented placeholder", "⟦1⟧ ⟦2⟧ ⟦3⟧ ⟦4⟧"],
    ["placeholder zero", "⟦0⟧ ⟦1⟧ ⟦2⟧ ⟦3⟧"],
  ])("rejects %s", (_what, translated) => {
    const { tokens } = protectTokens(source);

    expect(restoreProtectedTokens(translated, tokens)).toBeNull();
  });
});
