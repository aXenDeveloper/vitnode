import { ABSOLUTE_PATHS } from '@/app.module';
import { core_plugins } from '@/database/schema/plugins';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { ConfigPlugin } from 'vitnode-shared/admin/plugin.dto';
import {
  CreatePluginsAdminBody,
  ShowPluginAdmin,
} from 'vitnode-shared/admin/plugins.dto';

import { ChangeFilesPluginsAdminHelpersService } from '../helpers/change-files.service';
import { ValidateFilesPluginsAdminHelpersService } from '../helpers/validate-files.service';

@Injectable()
export class CreatePluginsAdminService {
  constructor(
    private readonly databaseService: InternalDatabaseService,
    private readonly validateFilesHelper: ValidateFilesPluginsAdminHelpersService,
    private readonly changeFilesHelper: ChangeFilesPluginsAdminHelpersService,
  ) {}

  private async createFiles({ code, ...rest }: CreatePluginsAdminBody) {
    const pluginPath = ABSOLUTE_PATHS.plugin({ code });
    const nameWithCapitalLetters =
      this.changeFilesHelper.changeCodePluginToCapitalLetters(code);

    const jsonFile: ConfigPlugin = {
      code,
      ...rest,
      allow_default: true,
      nav: [],
      version: '0.0.1',
      version_code: 1,
    };

    const folders: {
      files: { content: string; name: string }[];
      path: string;
    }[] = [
      {
        path: pluginPath.root,
        files: [
          {
            name: `${code}.module.ts`,
            content: `import { Module } from '@nestjs/common';

import { Admin${nameWithCapitalLetters}Module } from './admin/admin.module';

@Module({
  imports: [Admin${nameWithCapitalLetters}Module],
})
export class ${nameWithCapitalLetters}Module {}
`,
          },
          {
            name: 'config.json',
            content: JSON.stringify(jsonFile, null, 2),
          },
        ],
      },
      {
        path: pluginPath.frontend.templates,
        files: [
          {
            name: 'default-page.tsx',
            content: `export default function DefaultPage() {
  return <div className="container my-6 sm:my-10">Default Page for ${code}</div>;
}
`,
          },
        ],
      },
      {
        path: pluginPath.admin,
        files: [
          {
            name: 'admin.module.ts',
            content: `import { Module } from '@nestjs/common';

@Module({})
export class Admin${nameWithCapitalLetters}Module {}
`,
          },
        ],
      },
      {
        path: pluginPath.database,
        files: [
          {
            name: 'index.ts',
            content: `export default {};\n`,
          },
        ],
      },
      {
        path: pluginPath.shared,
        files: [
          {
            name: 'index.html',
            content: '',
          },
        ],
      },
    ];

    // Check if folder exists
    folders.forEach(folder => {
      if (existsSync(folder.path)) {
        throw new BadRequestException(
          `CONFLICT_PLUGIN_CODE - ${folder.path} Path already exists`,
        );
      }
    });

    await Promise.all(
      folders.map(async folder => {
        // Create folders
        await mkdir(folder.path, { recursive: true });

        // Create files
        await Promise.all(
          folder.files.map(async file => {
            try {
              await writeFile(join(folder.path, file.name), file.content);
            } catch (err) {
              const error = err as Error;
              throw new InternalServerErrorException(error.message);
            }
          }),
        );
      }),
    );
  }

  private async createLangFiles({
    code,
    name,
  }: {
    code: string;
    name: string;
  }) {
    const languages =
      await this.databaseService.db.query.core_languages.findMany({
        orderBy: (table, { asc }) => asc(table.code),
      });

    await Promise.all(
      languages.map(async lang => {
        const langPath = join(
          ABSOLUTE_PATHS.plugin({ code }).frontend.languages,
        );

        if (!existsSync(langPath)) {
          await mkdir(langPath, { recursive: true });
        }

        await writeFile(
          join(langPath, `${lang.code}.json`),
          JSON.stringify(
            {
              [code]: {},
              [`admin_${code}`]: {
                nav: {
                  title: name,
                },
              },
            },
            null,
            2,
          ),
          'utf-8',
        );
      }),
    );
  }

  async create({
    code,
    name,
    ...rest
  }: CreatePluginsAdminBody): Promise<ShowPluginAdmin> {
    const plugin = await this.databaseService.db.query.core_plugins.findFirst({
      where: (table, { eq }) => eq(table.code, code),
    });

    if (plugin || code === 'admin' || code === 'core' || code === 'members') {
      throw new ConflictException('PLUGIN_ALREADY_EXISTS');
    }

    this.validateFilesHelper.validateFiles({ code });
    await this.createFiles({ code, name, ...rest });
    await this.createLangFiles({ code, name: name });
    await this.changeFilesHelper.changeFiles({ code, action: 'add' });

    const [data] = await this.databaseService.db
      .insert(core_plugins)
      .values({
        code,
        name,
        ...rest,
      })
      .returning();

    return data;
  }
}
