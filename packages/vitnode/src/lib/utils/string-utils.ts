/**
 * Capitalizes the first letter of a string
 * @param input String to capitalize
 * @returns String with first letter capitalized
 */
export function capitalizeFirstLetter(input: string): string {
  if (!input || input.length === 0) return input;

  return input.charAt(0).toUpperCase() + input.slice(1);
}

/**
 * Truncates a string to a specified length and adds ellipsis if truncated
 * @param input String to truncate
 * @param maxLength Maximum length before truncation
 * @param suffix Suffix to add if truncated (default: '...')
 * @returns Truncated string
 */
export function truncateString(
  input: string,
  maxLength: number,
  suffix = '...',
): string {
  if (!input || input.length <= maxLength) return input;

  return input.slice(0, maxLength) + suffix;
}
