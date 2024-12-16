import { SSOAuthHelper } from '@/helpers/auth/sso/sso.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { rm, writeFile } from 'fs/promises';

@Injectable()
export class DeleteMethodsAuthSettingsAdminService {
  constructor(private readonly ssoAuthHelper: SSOAuthHelper) {}

  async delete(code: string): Promise<void> {
    const sso = await this.ssoAuthHelper.getActiveSSO(code);
    if (!sso) {
      throw new NotFoundException(`SSO method with ${code} code not found`);
    }

    const ssoConfigFile = await this.ssoAuthHelper.getSSOConfig();
    ssoConfigFile.sso = ssoConfigFile.sso.filter(item => item.code !== code);
    if (ssoConfigFile.sso.length === 0) {
      await rm(this.ssoAuthHelper.path);

      return;
    }

    await writeFile(
      this.ssoAuthHelper.path,
      JSON.stringify(ssoConfigFile, null, 2),
    );
  }
}
