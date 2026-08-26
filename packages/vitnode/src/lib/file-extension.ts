/**
 * File-name extension helpers, with no Node built-ins behind them.
 *
 * Their own module because both halves of the Content Engine need them: the
 * upload route reads an extension off a `File` on the server, and
 * `AutoFormFile` reads it off the same file in the browser to say "that is not
 * one of the allowed formats" before spending anybody's bandwidth. `lib/api/upload`
 * re-exports these rather than keeping a second copy, so the two answers cannot
 * drift.
 */

/**
 * The extension of a file name, lowercased and including the leading dot.
 *
 * `""` when there is none - a dotfile (`.env`) has no extension either, which is
 * why the dot has to be past the first character.
 */
export const getFileExtension = (fileName: string): string => {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === fileName.length - 1) {
    return "";
  }

  return fileName.slice(lastDot).toLowerCase();
};

export const replaceFileExtension = (
  fileName: string,
  extension: string,
): string => {
  const current = getFileExtension(fileName);
  const base = current ? fileName.slice(0, -current.length) : fileName;

  return `${base}${extension}`;
};
