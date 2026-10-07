export interface AiActionTranslate {
  (key: string): string;
  has: (key: string) => boolean;
}

export const translateAiActionText = (
  t: AiActionTranslate,
  key: string,
): string => (t.has(key) ? t(key) : key);

export const withTranslatedAiActionText = <
  T extends { description: string; title: string },
>(
  t: AiActionTranslate,
  action: T,
): T => ({
  ...action,
  description: translateAiActionText(t, action.description),
  title: translateAiActionText(t, action.title),
});
