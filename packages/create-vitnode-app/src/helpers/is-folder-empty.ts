import { lstatSync, readdirSync } from "node:fs";
import { join } from "node:path";
import colors from "picocolors";

export function isFolderEmpty(root: string, name: string): boolean {
  const validFiles = [
    ".DS_Store",
    ".git",
    ".gitattributes",
    ".gitignore",
    ".gitlab-ci.yml",
    ".hg",
    ".hgcheck",
    ".hgignore",
    ".idea",
    ".npmignore",
    ".travis.yml",
    "LICENSE",
    "Thumbs.db",
    "docs",
    "mkdocs.yml",
    "npm-debug.log",
    "yarn-debug.log",
    "yarn-error.log",
    "yarnrc.yml",
    ".yarn",
  ];

  const conflicts = readdirSync(root).filter(
    file => !(validFiles.includes(file) || file.endsWith(".iml")),
  );

  if (conflicts.length > 0) {
    console.log(
      `The directory ${colors.green(name)} contains files that could conflict:\n`,
    );
    for (const file of conflicts) {
      try {
        const stats = lstatSync(join(root, file));
        if (stats.isDirectory()) {
          console.log(`${colors.blue(file)}/`);
        } else {
          console.log(file);
        }
      } catch {
        console.log(file);
      }
    }

    console.log(
      "\nEither try using a new directory name, or remove the files listed above.\n",
    );

    return false;
  }

  return true;
}
