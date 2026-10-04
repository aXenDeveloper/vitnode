export const withoutHmrTimestamp = (assetUrl: string): string =>
  assetUrl.replace(/\?t=\d+$/, '')
