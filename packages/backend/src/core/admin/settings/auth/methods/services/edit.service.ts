import { SSOAuthHelper } from '@/helpers/auth/sso.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { writeFile } from 'fs/promises';
import {
  EditMethodAuthSettingsAdminBody,
  ShowMethodAuthSettingsAdmin,
} from 'vitnode-shared/admin/settings/auth.dto';

@Injectable()
export class EditMethodsAuthSettingsAdminService {
  constructor(private readonly ssoAuthHelper: SSOAuthHelper) {}

  async edit({
    code,
    body: { client_id, client_secret, enabled },
  }: {
    body: EditMethodAuthSettingsAdminBody;
    code: string;
  }): Promise<ShowMethodAuthSettingsAdmin> {
    const sso = await this.ssoAuthHelper.getActiveSSO(code);
    if (!sso) {
      throw new NotFoundException(`SSO method with ${code} code not found`);
    }
    const ssoConfigFile = await this.ssoAuthHelper.getSSOConfig();
    const ssoConfig = ssoConfigFile.sso;
    const ssoIndex = ssoConfig.findIndex(item => item.code === code);
    if (ssoIndex === -1) {
      throw new NotFoundException(`SSO method with ${code} code not found`);
    }
    ssoConfig[ssoIndex] = {
      ...ssoConfig[ssoIndex],
      client_id,
      client_secret,
      enabled,
    };

    await writeFile(
      this.ssoAuthHelper.path,
      JSON.stringify(ssoConfigFile, null, 2),
    );

    return {
      ...ssoConfig[ssoIndex],
      name: sso.name,
    };
  }
}
