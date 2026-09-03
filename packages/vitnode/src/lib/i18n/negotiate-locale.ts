export const negotiateLocale = (
  header: null | string | undefined,
  locales: string[],
): string | undefined => {
  if (!header || locales.length === 0) return undefined;

  const ranked = header
    .split(",")
    .map(part => {
      const [tag, ...params] = part.trim().split(";");
      const rawQuality = params
        .map(param => param.trim())
        .find(param => param.startsWith("q="))
        ?.slice(2);
      const quality = rawQuality === undefined ? 1 : Number(rawQuality);

      return {
        quality: Number.isFinite(quality) ? quality : 0,
        tag: tag.trim().toLowerCase(),
      };
    })
    .filter(entry => entry.tag.length > 0 && entry.quality > 0)
    // Sort is stable, so equal weights keep the order the client sent them in.
    .sort((a, b) => b.quality - a.quality);

  const byCode = new Map(locales.map(code => [code.toLowerCase(), code]));

  for (const { tag } of ranked) {
    if (tag === "*") return locales[0];

    const exact = byCode.get(tag);
    if (exact) return exact;

    const primary = byCode.get(tag.split("-")[0]);
    if (primary) return primary;
  }

  return undefined;
};
