import { SSOAuthConfig, SSOAuthHelper } from '@/helpers/auth/sso.service';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { existsSync } from 'fs';
import { writeFile } from 'fs/promises';
import {
  CreateMethodAuthSettingsAdminBody,
  ShowMethodAuthSettingsAdmin,
} from 'vitnode-shared/admin/settings/auth.dto';

@Injectable()
export class CreateMethodsAuthSettingsAdminService {
  constructor(private readonly ssoAuthHelper: SSOAuthHelper) {}

  async create({
    code,
    client_id,
    client_secret,
  }: CreateMethodAuthSettingsAdminBody): Promise<ShowMethodAuthSettingsAdmin> {
    const sso = this.ssoAuthHelper.getSSO(code);
    if (!sso) {
      throw new NotFoundException(`SSO method with ${code} code not found`);
    }

    const dataSSO: SSOAuthConfig['sso'][0] = {
      client_id,
      client_secret,
      code,
      enabled: true,
    };

    if (!existsSync(this.ssoAuthHelper.path)) {
      const dataToSave: SSOAuthConfig = {
        sso: [dataSSO],
      };

      await writeFile(
        this.ssoAuthHelper.path,
        JSON.stringify(dataToSave, null, 2),
      );

      return {
        ...dataSSO,
        name: sso.name,
      };
    }

    const ssoConfig = await this.ssoAuthHelper.getSSOConfig();
    const checkIfSSOExists = ssoConfig.sso.find(item => item.code === code);
    if (checkIfSSOExists) {
      throw new ConflictException(
        `SSO method with ${code} code already exists`,
      );
    }

    ssoConfig.sso.push(dataSSO);
    await writeFile(
      this.ssoAuthHelper.path,
      JSON.stringify(ssoConfig, null, 2),
    );

    return {
      ...dataSSO,
      name: sso.name,
    };
  }
}
