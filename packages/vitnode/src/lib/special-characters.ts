export const removeSpecialCharacters = (
  text: string,
  replaceSpace = true,
): string =>
  text
    .trimStart()
    .trimEnd()
    .replace(/\s/g, replaceSpace ? '-' : ' ')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[#%&?^|'{}\\/]/g, '')
    .replace(/ł/g, 'l')
    .replace(/@/g, '-at-')
    .replace(/\./g, '-')
    .trim();

export const checkSpecialCharacters = (text: string): boolean => {
  return /^[a-z0-9-]+$/i.test(text);
};
