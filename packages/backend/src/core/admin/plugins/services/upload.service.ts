import { ABSOLUTE_PATHS } from '@/app.module';
import { core_plugins } from '@/database/schema/plugins';
import { ConfigHelperService } from '@/helpers/config.service';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotImplementedException,
} from '@nestjs/common';
import { existsSync } from 'fs';
import { cp, mkdir, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { Readable } from 'stream';
import * as tar from 'tar';
import { ConfigPlugin } from 'vitnode-shared/admin/plugin.dto';
import { UploadPluginsAdminBody } from 'vitnode-shared/admin/plugins.dto';

import { ChangeFilesPluginsAdminHelpersService } from '../helpers/change-files.service';
import { ValidateFilesPluginsAdminHelpersService } from '../helpers/validate-files.service';

@Injectable()
export class UploadPluginsAdminService {
  constructor(
    private readonly databaseService: InternalDatabaseService,
    private readonly validateFilesHelper: ValidateFilesPluginsAdminHelpersService,
    private readonly changeFilesHelper: ChangeFilesPluginsAdminHelpersService,
    private readonly configHelper: ConfigHelperService,
  ) {}

  private async copyFrontendFiles({
    code,
    tempFolder,
  }: {
    code: string;
    tempFolder: string;
  }) {
    const pathToFrontend = ABSOLUTE_PATHS.plugin({ code });
    const frontendPaths = [
      'admin_pages_auth',
      'admin_pages',
      'pages',
      'pages_main',
      'pages_main_layout',
      'pages_root',
      'plugin',
    ] as const;
    await Promise.all(
      frontendPaths.map(async path => {
        const pathToCopy = join(tempFolder, 'frontend', path);
        if (!existsSync(pathToCopy)) return;
        const pathToPaste = pathToFrontend.frontend[path];

        await cp(pathToCopy, pathToPaste, { recursive: true });
      }),
    );

    // Copy languages
    const languages =
      await this.databaseService.db.query.core_languages.findMany({
        columns: {
          code: true,
        },
      });
    await Promise.all(
      languages.map(async language => {
        const langPath = join(
          pathToFrontend.frontend.languages,
          `${language.code}.json`,
        );

        if (existsSync(langPath)) return;

        const sourceLang = join(pathToFrontend.frontend.languages, 'en.json');
        await cp(sourceLang, langPath);
      }),
    );
  }

  private async copyFrontendOrBackendFiles({
    code,
    tempPath,
    type,
  }: {
    code: string;
    tempPath: string;
    type: 'backend' | 'shared';
  }) {
    const path =
      type === 'shared'
        ? ABSOLUTE_PATHS.plugin({ code }).shared
        : ABSOLUTE_PATHS.plugin({ code }).root;

    // If exists, remove the folder
    if (existsSync(path)) {
      await rm(path, { recursive: true });
    }
    await mkdir(path);

    // Copy from temp folder to plugin folder
    await cp(join(tempPath, type), path, { recursive: true });
  }

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

  async upload({
    files: { file },
    body: { code },
  }: {
    body: Omit<UploadPluginsAdminBody, 'file'>;
    files: Pick<UploadPluginsAdminBody, 'file'>;
  }) {
    if (!file.originalname.endsWith('.tgz')) {
      throw new BadRequestException('Invalid file type');
    }

    const tempPath = join(
      ABSOLUTE_PATHS.uploads.temp,
      'plugins',
      `${file.originalname.replace('.tgz', '')}_${new Date().getTime()}`,
    );
    const configPlugin = await this.getPluginConfigAndSaveFilesIntoTempFile({
      file,
      tempPath,
    });

    if (code) {
      throw new NotImplementedException();
    }

    // Validation
    if (code) {
      const checkPlugin =
        await this.databaseService.db.query.core_plugins.findFirst({
          where: (table, { eq }) => eq(table.code, code),
        });

      if (
        (checkPlugin && !code) ||
        code === 'core' ||
        code === 'admin' ||
        code === 'members'
      ) {
        await rm(tempPath, { recursive: true });
        throw new ConflictException('PLUGIN_ALREADY_EXISTS');
      }

      if (code && code !== configPlugin.code) {
        await rm(tempPath, { recursive: true });
        throw new BadRequestException('PLUGIN_CODE_NOT_MATCH');
      }

      if (
        checkPlugin &&
        code &&
        configPlugin.version_code < checkPlugin.version_code
      ) {
        await rm(tempPath, { recursive: true });
        throw new BadRequestException('PLUGIN_VERSION_IS_LOWER');
      }
    } else {
      try {
        this.validateFilesHelper.validateFiles({ code: configPlugin.code });
      } catch (e) {
        const error = e as Error;
        await rm(tempPath, { recursive: true });
        throw new ConflictException(error.message);
      }
    }

    await this.configHelper.updateConfig({
      restart_server: true,
    });

    // Copy files
    await Promise.all([
      this.copyFrontendOrBackendFiles({
        code: configPlugin.code,
        tempPath,
        type: 'shared',
      }),
      this.copyFrontendFiles({
        code: configPlugin.code,
        tempFolder: tempPath,
      }),
      this.changeFilesHelper.changeFiles({
        code: configPlugin.code,
        action: 'add',
      }),
      this.copyFrontendOrBackendFiles({
        code: configPlugin.code,
        tempPath,
        type: 'backend',
      }),
      this.databaseService.db.insert(core_plugins).values(configPlugin),
    ]);
  }
}
