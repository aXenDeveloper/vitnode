export interface PillSlot {
  code: string;
  key: string;
}

const uniqueKey = (code: string, used: Set<string>) => {
  let key = code;
  for (let attempt = 1; used.has(key); attempt++) key = `${code}:${attempt}`;

  return key;
};

export const assignPillSlots = (
  previous: readonly PillSlot[],
  codes: readonly string[],
): PillSlot[] => {
  const nextCodes = new Set(codes);
  const keyByCode = new Map(previous.map(slot => [slot.code, slot.key]));
  const used = new Set<string>();

  return codes.map((code, index) => {
    const kept = keyByCode.get(code);
    const replaced = previous.at(index);
    const key =
      kept ??
      (replaced && !nextCodes.has(replaced.code) && !used.has(replaced.key)
        ? replaced.key
        : uniqueKey(code, new Set([...used, ...keyByCode.values()])));
    used.add(key);

    return { code, key };
  });
};

const sameCodes = (slots: readonly PillSlot[], codes: readonly string[]) =>
  slots.length === codes.length &&
  slots.every((slot, index) => slot.code === codes[index]);

export const nextPillSlots = (
  previous: readonly PillSlot[],
  codes: readonly string[],
) => (sameCodes(previous, codes) ? previous : assignPillSlots(previous, codes));
