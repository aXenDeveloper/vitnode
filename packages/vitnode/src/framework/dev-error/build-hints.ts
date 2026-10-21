import type { DevErrorHint } from "./hints";

const UNRESOLVED_IMPORT = /Failed to resolve import "([^"]+)" from "([^"]+)"/;

const packageNameOf = (specifier: string): string => {
  const [first = "", second = ""] = specifier.split("/");

  return first.startsWith("@") ? `${first}/${second}` : first;
};

export const buildErrorHints = (message: string): DevErrorHint[] => {
  const match = UNRESOLVED_IMPORT.exec(message);
  if (!match) return [];

  const [, specifier = "", importer = ""] = match;

  if (specifier.startsWith(".") || specifier.startsWith("/")) {
    return [
      {
        description: `No file matches "${specifier}" next to ${importer}. Check the spelling, the folder and the file extension.`,
        title: "Check the path",
      },
    ];
  }

  const packageName = packageNameOf(specifier);
  const subpath = specifier.slice(packageName.length);

  return [
    {
      description: subpath
        ? `"${specifier}" has to match an entry in the "exports" field of ${packageName}'s package.json, and that entry has to point at a file that exists.`
        : `${packageName}'s package.json needs a "." entry in "exports" (or a "main") pointing at a file that exists.`,
      title: "Check the package exports",
    },
    {
      description: `If ${packageName} lives in this workspace, its dist may be out of date. Keep pnpm dev running so it rebuilds on save.`,
      snippet: "pnpm dev",
      title: "Rebuild the package",
    },
    {
      description: `If ${packageName} isn't a dependency yet, add it to the package that imports it.`,
      snippet: `pnpm add ${packageName}`,
      title: "Install the package",
    },
  ];
};
