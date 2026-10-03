export interface ComboboxOption {
  group?: string;
  label: string;
  value: string;
}

export interface ComboboxItemGroup {
  items: string[];
  value: string;
}

export const groupComboboxItems = (
  values: readonly string[],
  options: readonly ComboboxOption[],
): ComboboxItemGroup[] | null => {
  if (!options.some(option => option.group)) return null;

  const groupOf = new Map(
    options.map(option => [option.value, option.group ?? ""]),
  );
  const groups = new Map<string, string[]>();

  for (const value of values) {
    const group = groupOf.get(value) ?? "";
    groups.set(group, [...(groups.get(group) ?? []), value]);
  }

  return [...groups].map(([value, items]) => ({ items, value }));
};
