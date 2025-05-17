/* eslint-disable no-console */
import chokidar from 'chokidar';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { basename, dirname, extname, join, relative } from 'path';

// Regex patterns for import statements
const relativeImportRegex =
  /import\s+(?:(?:{[^}]*})|(?:[^{}\s,]*))?\s*(?:,\s*(?:{[^}]*}))?\s*from\s+['"]([./]+[^'"]*)['"]/g;
const atImportRegex =
  /import\s+(?:(?:{[^}]*})|(?:[^{}\s,]*))?\s*(?:,\s*(?:{[^}]*}))?\s*from\s+['"](@\/[^'"]*)['"]/g;
const jsExtensionRegex = /\.(js|jsx|ts|tsx)$/;

// Function to transform file content by updating import statements
const transformFileImports = (content: string, pluginName: string): string => {
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

const copyFile = (srcPath: string, destPath: string, pluginName?: string) => {
  try {
    const destDir = destPath.substring(0, destPath.lastIndexOf('/'));
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

    // Show even shorter, project-rooted paths for clarity
    const repoRoot = findRepoRoot(process.cwd());
    // Remove everything before '/src/app' in the source path if present
    const srcAppIdx = srcPath.indexOf('/src/app');
    const shortSrc =
      srcAppIdx !== -1
        ? srcPath.substring(srcAppIdx)
        : srcPath.startsWith(repoRoot)
          ? srcPath.substring(repoRoot.length + 1)
          : srcPath;
    const shortDest = destPath.startsWith(repoRoot)
      ? destPath.substring(repoRoot.length + 1)
      : destPath;
    console.log(`\x1b[32mCopied:\x1b[0m ${shortSrc} → ${shortDest}`);
  } catch (error) {
    console.error(`\x1b[31mError copying file:\x1b[0m ${srcPath}`, error);
  }
};

const removeFile = (filePath: string) => {
  try {
    if (existsSync(filePath)) {
      unlinkSync(filePath);
      console.log(`\x1b[33mRemoved:\x1b[0m ${filePath}`);
    }
  } catch (error) {
    console.error(`\x1b[31mError removing file:\x1b[0m ${filePath}`, error);
  }
};

function findRepoRoot(start: string): string {
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

const getAllFiles = (dir: string): string[] => {
  const files: string[] = [];
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

const cleanupDeletedFiles = (sourceDir: string, destinationDir: string) => {
  if (!existsSync(destinationDir)) return;

  const destFiles = getAllFiles(destinationDir);
  for (const destFile of destFiles) {
    const relativePath = relative(destinationDir, destFile);
    const sourceFile = join(sourceDir, relativePath);

    if (!existsSync(sourceFile)) {
      removeFile(destFile);
    }
  }
};

export const processPlugin = ({ initMessage }: { initMessage: string }) => {
  const pluginDir = process.cwd();
  const repoRoot = findRepoRoot(pluginDir);
  const pluginName = basename(pluginDir);

  // Get the package name from package.json for imports
  let packageName = '';
  try {
    const packageJsonPath = join(pluginDir, 'package.json');
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      packageName = packageJson.name ?? '';
    }
  } catch (error) {
    console.error(`\x1b[31mError reading package.json:\x1b[0m`, error);
  }

  const sourceDir = join(pluginDir, 'src', 'app');
  const destinationDir = join(
    repoRoot,
    'apps',
    'web',
    'src',
    'app',
    '[locale]',
    '(main)',
    pluginName === 'vitnode'
      ? join('(vitnode)')
      : join('(plugins)', `(${pluginName})`),
  );

  // Create destination directory if it doesn't exist
  if (!existsSync(destinationDir)) {
    mkdirSync(destinationDir, { recursive: true });
  }

  // Clean up any files that were deleted while the script wasn't running
  cleanupDeletedFiles(sourceDir, destinationDir);

  console.log(
    `${initMessage} \x1b[34mWatching for changes in plugins...\x1b[0m`,
  );

  const watcher = chokidar.watch(sourceDir, {
    ignoreInitial: false,
    persistent: true,
  });

  const getDestinationPath = (srcPath: string): string => {
    const relativePath = srcPath.substring(sourceDir.length);

    return join(destinationDir, relativePath);
  };

  watcher
    .on('add', filePath => {
      const destPath = getDestinationPath(filePath);
      copyFile(filePath, destPath, packageName);
    })
    .on('change', filePath => {
      const destPath = getDestinationPath(filePath);
      copyFile(filePath, destPath, packageName);
    })
    .on('unlink', filePath => {
      const destPath = getDestinationPath(filePath);
      removeFile(destPath);
    })
    .on('error', error => {
      console.error('\x1b[31mWatcher error:\x1b[0m', error);
    });
};
