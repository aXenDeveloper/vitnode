import { ABSOLUTE_PATHS } from '@/app.module';
import { Injectable } from '@nestjs/common';
import { existsSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

@Injectable()
export class ChangeFilesPluginsAdminHelpersService {
  readonly changeCodePluginToCapitalLetters = (str: string) => {
    return (
      str.charAt(0).toUpperCase() +
      str.slice(1).replace(/-([a-z])/g, g => g[1].toUpperCase())
    );
  };

  private async updateConfigFile(code: string, action: 'add' | 'delete') {
    const filePath = join(ABSOLUTE_PATHS.backend, 'database', 'config.ts');

    await this.updateFileContent({
      code,
      action,
      filePath,
      importRegex: /import (\w+) from ['"](.*)['"];/g,
      entryRegex: /export const schemaDatabase = {([\s\S]*?)};/,
      getImportNameAndPath: code => ({
        importName: `table${this.changeCodePluginToCapitalLetters(code)}`,
        importPath: `@/plugins/${code}/admin/database/index`,
      }),
      getEntryName: code =>
        `...table${this.changeCodePluginToCapitalLetters(code)}`,
      reconstructFileContent: (imports, entries, originalContent) => {
        let newContent = '';
        imports.forEach((path, name) => {
          newContent += `import ${name} from '${path}';\n`;
        });

        newContent += `\nexport const schemaDatabase = {\n`;
        const allEntries = Array.from(entries).join(',\n  ');
        newContent += `  ${allEntries},\n};`;

        // Append the rest of the file
        const restOfFile = originalContent.split(
          /export const schemaDatabase = {[\s\S]*?};/,
        )[1];
        if (restOfFile) {
          newContent += restOfFile;
        }

        return newContent;
      },
    });
  }

  private async updateFileContent({
    code,
    action,
    filePath,
    importRegex,
    entryRegex,
    getImportNameAndPath,
    getEntryName,
    reconstructFileContent,
  }: {
    action: 'add' | 'delete';
    code: string;
    entryRegex: RegExp;
    filePath: string;
    getEntryName: (code: string) => string;
    getImportNameAndPath: (code: string) => {
      importName: string;
      importPath: string;
    };
    importRegex: RegExp;
    reconstructFileContent: (
      imports: Map<string, string>,
      entries: Set<string>,
      originalContent: string,
    ) => string;
  }) {
    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const fileContent = await readFile(filePath, 'utf8');

    const existingImports = new Map<string, string>();
    const existingEntries = new Set<string>();

    // Extract existing import statements
    let match: null | RegExpExecArray;
    while ((match = importRegex.exec(fileContent)) !== null) {
      const importName = match[1];
      const importPath = match[2];
      existingImports.set(importName, importPath);
    }

    // Extract existing entries
    const entryMatch = entryRegex.exec(fileContent);
    if (entryMatch?.[1]) {
      const entriesList = entryMatch[1]
        .split(/[,&]/)
        .map(entry => entry.trim())
        .filter(entry => entry.length > 0);
      entriesList.forEach(entry => existingEntries.add(entry));
    }

    // Get import name and path
    const { importName, importPath } = getImportNameAndPath(code);
    const entryName = getEntryName(code);

    // Add or remove based on action
    if (action === 'add') {
      existingImports.set(importName, importPath);
      existingEntries.add(entryName);
    } else if (action === 'delete') {
      existingImports.delete(importName);
      existingEntries.delete(entryName);
    } else {
      throw new Error(`Invalid action: ${action}`);
    }

    // Reconstruct file content
    const newFileContent = reconstructFileContent(
      existingImports,
      existingEntries,
      fileContent,
    );

    // Write the updated content back to the file
    await writeFile(filePath, newFileContent, 'utf8');
  }

  private async updateGlobalDTSFile(code: string, action: 'add' | 'delete') {
    const filePath = join(ABSOLUTE_PATHS.frontend_root, 'global.d.ts');

    await this.updateFileContent({
      code,
      action,
      filePath,
      importRegex: /import type (\w+) from ['"](.*)['"];/g,
      entryRegex: /type Messages = ([^;]+);/,
      getImportNameAndPath: code => ({
        importName: code,
        importPath: `@/plugins/${code}/langs/en.json`,
      }),
      getEntryName: code => `typeof ${code.replace(/-/g, '_')}`,
      reconstructFileContent: (imports, entries, originalContent) => {
        let newContent = '';
        imports.forEach((path, name) => {
          newContent += `import type ${name.replace(/-/g, '_')} from '${path}';\n`;
        });

        newContent += `\n`;

        const allEntries = Array.from(entries).join(' & ');
        newContent += `type Messages = ${allEntries};`;

        // Append the rest of the file
        const restOfFile = originalContent.split(/type Messages = [^;]+;/)[1];
        if (restOfFile) {
          newContent += restOfFile;
        }

        return newContent;
      },
    });
  }

  private async updatePluginModuleFile(code: string, action: 'add' | 'delete') {
    const filePath = join(ABSOLUTE_PATHS.plugins, 'plugins.module.ts');

    await this.updateFileContent({
      code,
      action,
      filePath,
      importRegex: /import { (\w+) } from ['"](.*)['"];/g,
      entryRegex: /imports:\s*\[([^\]]*)\]/,
      getImportNameAndPath: code => ({
        importName: `${this.changeCodePluginToCapitalLetters(code)}Module`,
        importPath: `./${code}/${code}.module`,
      }),
      getEntryName: code =>
        `${this.changeCodePluginToCapitalLetters(code)}Module`,
      reconstructFileContent: (imports, entries) => {
        let newContent = `import { Module } from '@nestjs/common';\n\n`;
        for (const [name, path] of imports) {
          if (name === 'Module' && path === '@nestjs/common') {
            continue;
          }

          newContent += `import { ${name} } from '${path}';\n`;
        }

        const allEntries = Array.from(entries).join(', ');
        newContent += `\n@Module({\n  imports: [${allEntries}],\n})\nexport class PluginsModule {}\n`;

        return newContent;
      },
    });
  }

  async changeFiles({
    code,
    action,
  }: {
    action: 'add' | 'delete';
    code: string;
  }) {
    await Promise.all([
      this.updateGlobalDTSFile(code, action),
      this.updatePluginModuleFile(code, action),
      this.updateConfigFile(code, action),
    ]);
  }
}
