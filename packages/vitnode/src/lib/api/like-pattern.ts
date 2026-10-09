export const escapeLikePattern = (value: string): string =>
  value.replace(/[\\%_]/g, match => `\\${match}`);

export const containsLikePattern = (value: string): string =>
  `%${escapeLikePattern(value)}%`;
