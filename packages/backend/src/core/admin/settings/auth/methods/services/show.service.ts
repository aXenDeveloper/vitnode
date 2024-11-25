import { SSOAuthHelper } from '@/helpers/auth/sso.service';
import { Injectable } from '@nestjs/common';
import { ShowMethodAuthSettingsAdminObj } from 'vitnode-shared/admin/settings/auth.dto';

@Injectable()
export class ShowMethodsAuthSettingsAdminService {
  constructor(private readonly ssoAuthHelper: SSOAuthHelper) {}

  async show(): Promise<ShowMethodAuthSettingsAdminObj> {
    const test = this.ssoAuthHelper.getSSOs();

    return {
      edges: [
        {
          name: 'Standard',
          code: 'standard',
          enabled: true,
        },
      ],
    };
  }
}
