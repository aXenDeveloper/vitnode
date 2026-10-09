const ENGLISH_LANGUAGE_NAMES = new Intl.DisplayNames(["en"], {
  type: "language",
});

export const languageName = (code: string) => {
  try {
    return ENGLISH_LANGUAGE_NAMES.of(code) ?? code;
  } catch {
    return code;
  }
};
