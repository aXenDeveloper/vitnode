export const openAiSettings = (prev: Record<string, unknown>) => ({
  ...prev,
  settings: "open" as const,
});
