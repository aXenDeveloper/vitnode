export const buildSearchParams = (query: Record<string, string | string[]>) => {
  const searchParams = new URLSearchParams();

  for (const [k, v] of Object.entries(query)) {
    if (v === undefined) {
      continue;
    }

    if (Array.isArray(v)) {
      for (const v2 of v) {
        searchParams.append(k, v2);
      }
    } else {
      searchParams.set(k, v);
    }
  }

  return searchParams;
};
