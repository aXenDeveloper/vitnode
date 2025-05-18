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

const routeKey = (filePath: string, localeRoot: string): string => {
  const rel = relative(localeRoot, filePath);
  const parts = rel.split(sep);

  // remove filename
  parts.pop();

  // drop any group folders
  const filtered = parts.filter(p => !p.startsWith('('));

  // '' represents the root route
  return normalize(filtered.join('/'));
};

const buildInitialRouteMap = (localeRoot: string): Map<string, string> => {
  const map = new Map<string, string>();

  const visit = (dir: string) => {
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

interface SourceConfig {
  destinationDir: string;
  sourceDir: string;
}

export const processPlugin = ({ initMessage }: { initMessage: string }) => {
  const pluginDir = process.cwd();
  const repoRoot = findRepoRoot(pluginDir);
  const pluginName = basename(pluginDir);
  const localeRoot = join(repoRoot, 'apps', 'web', 'src', 'app', '[locale]');
  const routeMap = buildInitialRouteMap(localeRoot);

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

  const mainDest = join(
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
  const adminDest = join(
    repoRoot,
    'apps',
    'web',
    'src',
    'app',
    '[locale]',
    'admin',
    '(auth)',
    pluginName === 'vitnode'
      ? join('(vitnode)', 'core')
      : join('(plugins)', pluginName),
  );

  // tell the copier about both trees
  const sources: SourceConfig[] = [
    {
      sourceDir: join(pluginDir, 'src', 'app_admin'),
      destinationDir: adminDest,
    },
    { sourceDir: join(pluginDir, 'src', 'app'), destinationDir: mainDest },
  ];

  // Create destination directories if they don't exist
  for (const { destinationDir } of sources) {
    if (!existsSync(destinationDir)) {
      mkdirSync(destinationDir, { recursive: true });
    }
  }

  const copyFile = (srcPath: string, destPath: string, pluginName?: string) => {
    const fileName = basename(srcPath);
    if (pageFileRegex.test(fileName)) {
      const key = routeKey(destPath, localeRoot);

      const existing = routeMap.get(key);
      // another file (not this exact one) already owns the route
      if (existing && existing !== destPath) {
        console.log(
          `\x1b[31mSkipped duplicate page:\x1b[0m ${relative(
            repoRoot,
            destPath,
          )} (collides with ${relative(repoRoot, existing)})`,
        );

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

      // Show even shorter, project-rooted paths for clarity
      const repoRoot = findRepoRoot(process.cwd());
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

      // 📝  update the map now that the copy succeeded
      if (pageFileRegex.test(basename(destPath))) {
        const key = routeKey(destPath, localeRoot);
        routeMap.set(key, destPath);
      }
    } catch (error) {
      console.error(`\x1b[31mError copying file:\x1b[0m ${srcPath}`, error);
    }
  };

  const removeFile = (filePath: string) => {
    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
        console.log(`\x1b[33mRemoved:\x1b[0m ${filePath}`);

        if (pageFileRegex.test(basename(filePath))) {
          const key = routeKey(filePath, localeRoot);
          // only delete if this exact file is the one in the map
          if (routeMap.get(key) === filePath) {
            routeMap.delete(key);
          }
        }
      }
    } catch (error) {
      console.error(`\x1b[31mError removing file:\x1b[0m ${filePath}`, error);
    }
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

  // Clean up any files that were deleted while the script wasn't running
  // Clean up deleted files for each source directory
  for (const { sourceDir, destinationDir } of sources) {
    cleanupDeletedFiles(sourceDir, destinationDir);
  }

  console.log(
    `${initMessage} \x1b[34mWatching for changes in plugins...\x1b[0m`,
  );

  const sourceDirs = sources
    .map(s => s.sourceDir)
    .filter(dir => existsSync(dir));

  const watcher = chokidar.watch(sourceDirs, {
    ignoreInitial: false,
    persistent: true,
  });

  const getDestinationPath = (srcPath: string): string => {
    // collect all matching sourceConfigs
    const candidates = sources.filter(({ sourceDir }) =>
      srcPath.startsWith(sourceDir),
    );

    if (candidates.length === 0) {
      throw new Error(`No matching source directory for: ${srcPath}`);
    }

    // pick the one with the longest sourceDir (most specific)
    const sourceConfig = candidates.reduce((best, cur) =>
      cur.sourceDir.length > best.sourceDir.length ? cur : best,
    );

    // now append the relative path
    const relativePath = relative(sourceConfig.sourceDir, srcPath);

    return join(sourceConfig.destinationDir, relativePath);
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
