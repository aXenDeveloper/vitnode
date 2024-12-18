import { ABSOLUTE_PATHS } from '@/app.module';
import { SSOAuthHelper } from '@/helpers/auth/sso/sso.service';
import { getConfigFile } from '@/helpers/config';
import { ConfigHelperService } from '@/helpers/config.service';
import { EmailHelperService } from '@/helpers/email/email.service';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { AppTypeMainSettingsAdmin } from 'vitnode-shared/admin/settings/main.enum';
import { ManifestWithLang } from 'vitnode-shared/manifest.dto';
import { ShowMiddlewareObj } from 'vitnode-shared/middleware.dto';

import { NavMiddlewareService } from './nav.service';

@Injectable()
export class ShowMiddlewareService {
  constructor(
    private readonly databaseService: InternalDatabaseService,
    private readonly mailService: EmailHelperService,
    private readonly navService: NavMiddlewareService,
    private readonly ssoHelper: SSOAuthHelper,
    private readonly configService: ConfigHelperService,
  ) {}

  protected async getManifests({
    langCodes,
  }: {
    langCodes: string[];
  }): Promise<ManifestWithLang[]> {
    return await Promise.all(
      langCodes.map(async lang => {
        const path = join(
          ABSOLUTE_PATHS.uploads.public,
          'assets',
          lang,
          'manifest.webmanifest',
        );
        const manifest: ManifestWithLang = JSON.parse(
          await readFile(path, 'utf8'),
        );

        return manifest;
      }),
    );
  }

  async show(): Promise<ShowMiddlewareObj> {
    // TODO: Add cache
    const config = getConfigFile();
    const [plugins, langs] = await Promise.all([
      this.databaseService.db.query.core_plugins.findMany({
        columns: {
          code: true,
          default: true,
        },
      }),
      this.databaseService.db.query.core_languages.findMany({
        columns: {
          code: true,
          default: true,
          enabled: true,
          name: true,
          allow_in_input: true,
          timezone: true,
          time_24: true,
        },
      }),
    ]);

    const plugin_code_default = plugins.find(plugin => plugin.default)?.code;
    if (!plugin_code_default) {
      throw new InternalServerErrorException('Plugin not found');
    }
    const manifest = await this.getManifests({
      langCodes: langs.map(lang => lang.code),
    });
    const SSOs = await this.ssoHelper.getActiveSSOs();
    const configFromDb = await this.configService.getConfig();

    return {
      app_type: configFromDb.app_type as AppTypeMainSettingsAdmin,
      logos: {
        logo_dark: configFromDb.logo_dark,
        logo_light: configFromDb.logo_light,
        mobile_logo_dark: configFromDb.mobile_logo_dark,
        mobile_logo_light: configFromDb.mobile_logo_light,
        width: configFromDb.logo_width,
        mobile_width: configFromDb.logo_mobile_width,
        text: configFromDb.logo_text,
      },
      languages: langs,
      authorization: {
        force_login: configFromDb.auth_force_login,
        lock_register: configFromDb.auth_lock_register,
      },
      auth_methods: {
        password: true,
        sso: SSOs.filter(item => item.enabled).map(sso => ({
          name: sso.name,
          code: sso.code,
        })),
      },
      plugins: ['admin', 'core', ...plugins.map(plugin => plugin.code)],
      languages_code_default: langs.find(lang => lang.default)?.code ?? 'en',
      is_email_enabled: this.mailService.checkIfEnable(),
      is_ai_enabled: false, // TODO: Add AI service
      site_name: configFromDb.site_name,
      site_short_name: configFromDb.site_short_name,
      security: {
        captcha: {
          site_key: config.security.captcha.site_key,
          type: config.security.captcha.type,
        },
      },
      editor: {
        sticky: configFromDb.editor_sticky ?? false,
      },
      plugin_code_default,
      site_description: manifest.map(item => ({
        language_code: item.lang,
        value: item.description,
      })),
      contact_email: configFromDb.contact_email,
      nav: await this.navService.show(),
      last_updated: configFromDb.last_updated,
    };
  }
}
