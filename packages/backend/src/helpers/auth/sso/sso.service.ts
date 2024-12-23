import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ShowMethodAuthSettingsAdmin } from 'vitnode-shared/admin/settings/auth.dto';
import { SSOUrlAuthObj } from 'vitnode-shared/auth/sso.dto';

import { facebookSSO } from './facebook';
import { googleSSO } from './google';

export interface SSOAuthCallbackObj {
  email: string;
  id: string;
  name: string;
  verified_email: boolean;
}

export interface SSOAuthConfig {
  sso: {
    client_id: string;
    client_secret: string;
    code: string;
    enabled: boolean;
  }[];
}

export interface SSOAuthItem {
  callback: (args: {
    client_id: string;
    client_secret: string;
    code: string;
    redirect_uri: string;
  }) => Promise<{
    access_token: string;
  }>;
  code: string;
  getUrl: (args: {
    client_id: string;
    redirect_uri: string;
  }) => Pick<SSOUrlAuthObj, 'url'>;
  name: string;
  registerCallback: (args: {
    access_token: string;
  }) => Promise<SSOAuthCallbackObj>;
}

@Injectable()
export class SSOAuthHelper {
  constructor(
    @Inject('VITNODE_SSO_LOGIN_METHODS')
    private readonly loginMethods: SSOAuthItem[],
    private readonly databaseService: InternalDatabaseService,
  ) {}

  async getActiveSSO(
    code: string,
  ): Promise<SSOAuthConfig['sso'][0] & SSOAuthItem> {
    const item = this.getSSO(code);
    if (!item) {
      throw new NotFoundException(`SSO provider with ${code} code not found`);
    }

    const ssoConfig = (await this.getActiveSSOs()).find(
      sso => sso.code === code,
    );
    if (!ssoConfig) {
      throw new NotFoundException(`SSO provider with ${code} code not found`);
    }

    return { ...item, ...ssoConfig };
  }

  async getActiveSSOs(): Promise<ShowMethodAuthSettingsAdmin[]> {
    const ssoConfig =
      await this.databaseService.db.query.core_users_sso.findMany();
    const SSOs = this.getSSOs();
    const activeSSOs: ShowMethodAuthSettingsAdmin[] = [];
    ssoConfig.forEach(sso => {
      const ssoItem = SSOs.find(item => item.code === sso.code);
      if (!ssoItem) return;

      activeSSOs.push({
        ...sso,
        name: ssoItem.name,
      });
    });

    return activeSSOs;
  }

  getSSO(code: string) {
    return this.getSSOs().find(sso => sso.code === code);
  }

  getSSOs(): SSOAuthItem[] {
    return [googleSSO, facebookSSO, ...this.loginMethods];
  }
}
