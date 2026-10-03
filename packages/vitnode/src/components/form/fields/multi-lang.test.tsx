import { act, renderHook } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { MultiLangValue } from "@/lib/helpers/multi-lang";

import { LanguagesProvider } from "@/components/languages-provider";

import { useMultiLangField } from "./multi-lang";
import { MultiLangLanguageContext } from "./multi-lang-language";

const languages = [
  { code: "en", name: "English" },
  { code: "pl", name: "Polski" },
];

const value: MultiLangValue = [
  { languageCode: "en", value: "Hello" },
  { languageCode: "pl", value: "Cześć" },
];

const renderField = (lockedLanguage: null | string) => {
  const onChange = vi.fn();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <LanguagesProvider languages={languages}>
      <MultiLangLanguageContext value={lockedLanguage}>
        {children}
      </MultiLangLanguageContext>
    </LanguagesProvider>
  );
  const { result } = renderHook(
    () =>
      useMultiLangField({
        name: "title",
        onBlur: vi.fn(),
        onChange,
        value,
      }),
    { wrapper },
  );

  return { onChange, result };
};

describe("useMultiLangField", () => {
  it("lets the user pick a language when nothing locks it", () => {
    const { result } = renderField(null);

    expect(result.current.canSelect).toBe(true);
    expect(result.current.selected).toBe("en");
    expect(result.current.currentValue).toBe("Hello");
  });

  it("edits the locked language and hides the picker", () => {
    const { onChange, result } = renderField("pl");

    expect(result.current.canSelect).toBe(false);
    expect(result.current.selected).toBe("pl");
    expect(result.current.currentValue).toBe("Cześć");

    act(() => {
      result.current.setValue("Dzień dobry");
    });

    expect(onChange).toHaveBeenCalledWith([
      { languageCode: "en", value: "Hello" },
      { languageCode: "pl", value: "Dzień dobry" },
    ]);
  });

  it("ignores a language picked before the lock", () => {
    const { result } = renderField("pl");

    act(() => {
      result.current.setSelected("en");
    });

    expect(result.current.selected).toBe("pl");
  });
});
