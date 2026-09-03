import { pathToFileURL } from "node:url";

/** The fields of a `Stats` this needs, so a caller may pass a `Stats` or a test may not. */
export interface ModuleFileVersionSource {
  mtimeMs: number;
  size: number;
}

export const moduleFileVersion = ({
  mtimeMs,
  size,
}: ModuleFileVersionSource): string => `${size}-${mtimeMs}`;

/**
 * A file's URL, carrying a version Node's module cache will treat as new when
 * the file changes and as familiar when it has not.
 *
 * `searchParams.set` rather than string concatenation, so a path that already
 * contains a `?` or a `#` - or one whose name needs percent-encoding - is
 * handled by the URL parser instead of by this function.
 */
export const versionedModuleUrl = (
  file: string,
  version: ModuleFileVersionSource,
): string => {
  const url = pathToFileURL(file);

  url.searchParams.set("v", moduleFileVersion(version));

  return url.href;
};
