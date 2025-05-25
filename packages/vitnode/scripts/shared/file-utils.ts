/* eslint-disable no-console */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'fs';
import {
  basename,
  dirname,
  extname,
  join,
  normalize,
  relative,
  sep,
} from 'path';

// Regex patterns for import statements
const relativeImportRegex =
  /import\s+(?:(?:{[^}]*})|(?:[^{}\s,]*))?\s*(?:,\s*(?:{[^}]*}))?\s*from\s+['"]([./]+[^'"]*)['"]/g;
const atImportRegex =
  /import\s+(?:(?:{[^}]*})|(?:[^{}\s,]*))?\s*(?:,\s*(?:{[^}]*}))?\s*from\s+['"](@\/[^'"]*)['"]/g;
const jsExtensionRegex = /\.(js|jsx|ts|tsx)$/;
const pageFileRegex = /^page\.(tsx|ts|jsx|js)$/i;

export const routeKey = (filePath: string, localeRoot: string): string => {
  const rel = relative(localeRoot, filePath);
  const parts = rel.split(sep);

  // remove filename
  parts.pop();

  // drop any group folders
  const filtered = parts.filter(p => !p.startsWith('('));

  // '' represents the root route
  return normalize(filtered.join('/'));
};

export const buildInitialRouteMap = (
  localeRoot: string,
): Map<string, string> => {
  const map = new Map<string, string>();

  const visit = (dir: string) => {
    if (!existsSync(dir)) return;

    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);

      if (entry.isDirectory()) {
        visit(full);
        continue;
      }

      if (pageFileRegex.test(entry.name)) {
        const key = routeKey(full, localeRoot);
        map.set(key, full);
      }
    }
  };

  visit(localeRoot);

  return map;
};

// Function to transform file content by updating import statements
export const transformFileImports = (
  content: string,
  pluginName: string,
): string => {
  // First handle relative imports
  let transformedContent = content.replace(
    relativeImportRegex,
    (match, importPath: string) => {
      // Only transform relative imports (starting with ./ or ../)
      if (importPath.startsWith('.')) {
        // Remove any file extensions from the import path
        const cleanPath = importPath.replace(jsExtensionRegex, '');
        // Extract the path after removing leading '../' sequences
        const normalizedPath = cleanPath.replace(/^(?:\.\.\/)+/, '');
        // Return the package import format

        return match.replace(importPath, `${pluginName}/${normalizedPath}`);
      }

      return match;
    },
  );

  // Then handle @/ imports
  transformedContent = transformedContent.replace(
    atImportRegex,
    (match, importPath: string) => {
      // Remove '@/' prefix and any file extensions
      const cleanPath = importPath
        .replace(/^@\//, '')
        .replace(jsExtensionRegex, '');
      // Return the package import format

      return match.replace(importPath, `${pluginName}/${cleanPath}`);
    },
  );

  return transformedContent;
};

export function findRepoRoot(start: string): string {
  let dir = start;
  while (dir !== dirname(dir)) {
    if (
      existsSync(join(dir, 'turbo.json')) ||
      existsSync(join(dir, 'pnpm-workspace.yaml')) ||
      existsSync(join(dir, '.git'))
    )
      return dir;
    dir = dirname(dir);
  }
  throw new Error(
    '❌  Could not locate monorepo root – add a marker file or pass it via CLI/env',
  );
}

export const getAllFiles = (dir: string): string[] => {
  const files: string[] = [];
  if (!existsSync(dir)) return files;

  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
};

export interface SourceConfig {
  destinationDir: string;
  sourceDir: string;
}

export const copyFile = (
  srcPath: string,
  destPath: string,
  pluginName: string,
  routeMap: Map<string, string>,
  localeRoot: string,
  repoRoot: string,
  verbose = true,
) => {
  const fileName = basename(srcPath);
  if (pageFileRegex.test(fileName)) {
    const key = routeKey(destPath, localeRoot);

    const existing = routeMap.get(key);
    // another file (not this exact one) already owns the route
    if (existing && existing !== destPath) {
      if (verbose) {
        console.log(
          `\x1b[31mSkipped duplicate page:\x1b[0m ${relative(
            repoRoot,
            destPath,
          )} (collides with ${relative(repoRoot, existing)})`,
        );
      }

      return; // 🔥 skip the copy
    }
  }

  try {
    const destDir = dirname(destPath);
    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true });
    }

    // Check if file should have imports processed (like .js, .jsx, .ts, .tsx files)
    const ext = extname(srcPath);
    if (pluginName && ['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
      // Read file content
      const content = readFileSync(srcPath, 'utf-8');
      // Transform imports
      const transformedContent = transformFileImports(content, pluginName);
      // Write transformed content
      writeFileSync(destPath, transformedContent);
    } else {
      // Copy file directly without transforming
      copyFileSync(srcPath, destPath);
    }

    if (verbose) {
      // Show even shorter, project-rooted paths for clarity
      // Remove everything before '/src/app' in the source path if present
      const srcAppIdx = srcPath.indexOf(join('src', 'app'));
      const shortSrc =
        srcAppIdx !== -1
          ? srcPath.substring(srcAppIdx)
          : srcPath.startsWith(repoRoot)
            ? relative(repoRoot, srcPath)
            : srcPath;
      const shortDest = destPath.startsWith(repoRoot)
        ? relative(repoRoot, destPath)
        : destPath;
      console.log(`\x1b[32mCopied:\x1b[0m ${shortSrc} → ${shortDest}`);
    }

    // 📝  update the map now that the copy succeeded
    if (pageFileRegex.test(basename(destPath))) {
      const key = routeKey(destPath, localeRoot);
      routeMap.set(key, destPath);
    }
  } catch (error) {
    console.error(`\x1b[31mError copying file:\x1b[0m ${srcPath}`, error);
  }
};

export const copyDirectoryRecursive = (
  sourceDir: string,
  destinationDir: string,
  pluginName: string,
  routeMap: Map<string, string>,
  localeRoot: string,
  repoRoot: string,
  verbose = true,
) => {
  if (!existsSync(sourceDir)) return;

  const files = getAllFiles(sourceDir);

  for (const srcFile of files) {
    const relativePath = relative(sourceDir, srcFile);
    const destFile = join(destinationDir, relativePath);

    copyFile(
      srcFile,
      destFile,
      pluginName,
      routeMap,
      localeRoot,
      repoRoot,
      verbose,
    );
  }
};
