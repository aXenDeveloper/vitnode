const IMPORT_CALL = /\bimport\(\s*(?:"([^"]*)"|'([^']*)'|`([^`$\\]*)`)\s*[,)]/g;

export const lazyImportSpecifier = (load: unknown): null | string => {
  if (typeof load !== "function") return null;

  const source = String(load);
  const found = [...source.matchAll(IMPORT_CALL)].map(
    match => match[1] ?? match[2] ?? match[3],
  );

  if (found.length !== 1) return null;

  const [specifier] = found;

  if (!specifier?.startsWith(".")) return null;

  return specifier;
};
