import {
  core_config,
  core_config__insert_types,
  core_config__types,
} from '@/database/schema/config';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { FileObj } from 'vitnode-shared/utils/files.dto';

type CoreConfigDatabase = Omit<
  typeof core_config__types,
  'logo_dark' | 'logo_light' | 'mobile_logo_dark' | 'mobile_logo_light'
>;

export interface ConfigHelperInterface extends CoreConfigDatabase {
  email_logo: FileObj | null;
  logo_dark: FileObj | null;
  logo_light: FileObj | null;
  mobile_logo_dark: FileObj | null;
  mobile_logo_light: FileObj | null;
}

@Injectable()
export class ConfigHelperService {
  constructor(
    private readonly databaseService: InternalDatabaseService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async cleanCache() {
    await this.cacheManager.del('core_config');
  }

  async getConfig(): Promise<ConfigHelperInterface> {
    let config =
      await this.cacheManager.get<ConfigHelperInterface>('core_config');
    if (!config) {
      const current = await this.databaseService.db.query.core_config.findFirst(
        {
          with: {
            email_logo: true,
            logo_dark: true,
            logo_light: true,
            mobile_logo_dark: true,
            mobile_logo_light: true,
          },
        },
      );
      if (!current) {
        throw new InternalServerErrorException('CONFIG_NOT_FOUND');
      }

      config = current;
      await this.cacheManager.set('core_config', config);
    }

    return config;
  }

  async updateConfig(
    data: typeof core_config__insert_types,
  ): Promise<
    Omit<
      ConfigHelperInterface,
      | 'email_logo'
      | 'logo_dark'
      | 'logo_light'
      | 'mobile_logo_dark'
      | 'mobile_logo_light'
    >
  > {
    const [[config]] = await Promise.all([
      this.databaseService.db
        .update({ ...core_config, last_updated: new Date() })
        .set(data)
        .returning(),
      this.cleanCache(),
    ]);

    return config;
  }
}
