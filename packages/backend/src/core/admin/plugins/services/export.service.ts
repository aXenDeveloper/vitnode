import type { Response } from 'express';

import { ABSOLUTE_PATHS } from '@/app.module';
import { core_plugins } from '@/database/schema/plugins';
import { currentUnixDate, removeSpecialCharacters } from '@/functions';
import { generateRandomString } from '@/functions/generate-random-string';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { createReadStream, existsSync } from 'fs';
import { cp, mkdir, readFile, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import * as tar from 'tar';
import { ConfigPlugin } from 'vitnode-shared/admin/plugin.dto';
import { ExportPluginsAdminBody } from 'vitnode-shared/admin/plugins.dto';

@Injectable()
export class ExportPluginsAdminService {
  constructor(private readonly databaseService: InternalDatabaseService) {}

  private readonly tempPath = join(ABSOLUTE_PATHS.uploads.temp, 'plugins');

  async export({
    code,
    body: { version, version_code },
    res,
  }: {
    body: ExportPluginsAdminBody;
    code: string;
    res: Response;
  }) {
    const plugin = await this.databaseService.db.query.core_plugins.findFirst({
      where: (table, { eq }) => eq(table.code, code),
    });

    if (!plugin) {
      return res.status(404).json({ message: 'Plugin not found' });
    }

    // Update config.json
    const pathInfoJSON = ABSOLUTE_PATHS.plugin({ code }).config;
    const configJSON: ConfigPlugin = JSON.parse(
      await readFile(pathInfoJSON, 'utf8'),
    );

    if (
      (!version && !configJSON.version) ||
      (!version_code && !configJSON.version_code)
    ) {
      return res.status(400).json({
        message: 'Version and version_code are required',
      });
    }

    // Check if version_code is greater than the current version_code
    if (
      version_code &&
      configJSON.version_code &&
      version_code <= configJSON.version_code
    ) {
      return res.status(400).json({
        message: 'Version code must be greater than the current version code',
      });
    }

    configJSON.version = version ?? configJSON.version;
    configJSON.version_code = version_code ?? configJSON.version_code;

    await writeFile(pathInfoJSON, JSON.stringify(configJSON, null, 2), 'utf8');

    await this.databaseService.db
      .update(core_plugins)
      .set({
        version,
        version_code,
        updated_at: new Date(),
      })
      .where(eq(core_plugins.code, code));

    // Prepare the export
    const tempFolderName = removeSpecialCharacters(
      `${code}-${version ?? plugin.version}-${generateRandomString(5)}-${currentUnixDate()}`,
    );
    const tempPath = join(this.tempPath, tempFolderName);
    await mkdir(tempPath, { recursive: true });

    // Create folders for backend, frontend
    const backendPath = join(tempPath, 'backend');
    const frontendPath = join(tempPath, 'frontend');
    await Promise.all([
      mkdir(backendPath, { recursive: true }),
      mkdir(frontendPath, { recursive: true }),
    ]);

    // Copy backend files
    const backendSource = ABSOLUTE_PATHS.plugin({ code }).root;
    if (!existsSync(backendSource)) {
      return res.status(500).json({ message: 'Backend source does not exist' });
    }
    await cp(backendSource, backendPath, { recursive: true });

    // Copy frontend files
    const pathFiles = ABSOLUTE_PATHS.plugin({ code });
    const frontendPaths = [
      'admin_pages_auth',
      'admin_pages',
      'pages',
      'pages_main',
      'pages_root',
      'plugin',
    ] as const;
    await Promise.all(
      frontendPaths.map(async path => {
        const source = pathFiles.frontend[path];
        if (!existsSync(source)) {
          if (path === 'plugin') {
            return res
              .status(500)
              .json({ message: 'Frontend source does not exist' });
          }

          return;
        }

        await cp(source, join(frontendPath, path), { recursive: true });
      }),
    );

    // Copy shared files
    const sharedSource = ABSOLUTE_PATHS.plugin({ code }).shared;
    if (existsSync(sharedSource)) {
      const sharedPath = join(tempPath, 'shared');
      await mkdir(sharedPath, { recursive: true });
      await cp(sharedSource, sharedPath, { recursive: true });
    }

    // Create tar
    const file = join(ABSOLUTE_PATHS.uploads.temp, `${tempFolderName}.tgz`);

    try {
      await tar.create(
        {
          gzip: true,
          file,
          cwd: tempPath,
        },
        ['.'],
      );
    } catch (_) {
      return res.status(500).json({ message: 'Error creating tar' });
    }

    // Delete temp folder
    await rm(tempPath, { recursive: true });

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=${tempFolderName}.tgz`,
    );

    const stream = createReadStream(file);
    stream.pipe(res);
    stream.on('end', async () => {
      await rm(file);
    });
  }
}
