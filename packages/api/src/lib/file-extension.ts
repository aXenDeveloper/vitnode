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
