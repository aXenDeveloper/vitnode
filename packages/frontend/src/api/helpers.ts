export const buildFilteredQuery = (params: Record<string, unknown>): string => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (
      value !== undefined &&
      value !== '' &&
      !(Array.isArray(value) && value.length === 0) &&
      value
    ) {
      if (Array.isArray(value)) {
        value.forEach((v: string) => {
          searchParams.append(key, v);
        });

        return;
      }

      searchParams.append(
        key,
        typeof value === 'string' ? value : JSON.stringify(value),
      );
    }
  });

  return searchParams.toString();
};
