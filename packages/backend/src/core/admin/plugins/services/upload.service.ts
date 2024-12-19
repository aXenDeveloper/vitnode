import { ABSOLUTE_PATHS } from '@/app.module';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { BadRequestException, Injectable } from '@nestjs/common';
import { mkdir, readdir, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { ConfigPlugin } from 'vitnode-shared/admin/plugin.dto';
import { UploadPluginsAdminBody } from 'vitnode-shared/admin/plugins.dto';
import * as tar from 'tar';
import { Readable } from 'stream';

@Injectable()
export class UploadPluginsAdminService {
  constructor(private readonly databaseService: InternalDatabaseService) {}

  private async getPluginConfigAndSaveFilesIntoTempFile({
    file,
    tempPath,
  }: {
    file: Express.Multer.File;
    tempPath: string;
  }): Promise<ConfigPlugin> {
    // Create folders
    await mkdir(tempPath, { recursive: true });
    const stream = Readable.from(file.buffer);
    await new Promise((resolve, reject) => {
      stream
        .pipe(tar.extract({ C: tempPath, strip: 1 }))
        .on('end', resolve)
        .on('error', reject);
    });

    const config: ConfigPlugin = JSON.parse(
      await readFile(join(tempPath, 'backend', 'config.json'), 'utf-8'),
    );

    // Check if variables exists
    if (
      !config.name ||
      !config.author ||
      !config.code ||
      !config.support_url ||
      !config.version ||
      !config.version_code
    ) {
      await rm(tempPath, { recursive: true });
      throw new BadRequestException('PLUGIN_CONFIG_VARIABLES_NOT_FOUND');
    }

    return config;
  }

  private isTgzFile(file: Express.Multer.File) {
    if (!file.originalname.endsWith('.tgz')) {
      throw new BadRequestException('Invalid file type');
    }
  }

  async upload({
    files: { file },
  }: {
    files: Pick<UploadPluginsAdminBody, 'file'>;
  }) {
    this.isTgzFile(file);
    const tempPath = join(
      ABSOLUTE_PATHS.uploads.temp,
      'plugins',
      `${file.originalname.replace('.tgz', '')}_${new Date().getTime()}`,
    );
    const configPlugin = await this.getPluginConfigAndSaveFilesIntoTempFile({
      file,
      tempPath,
    });

    return 'test';
  }
}
