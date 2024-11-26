import { SSOAuthHelper } from '@/helpers/auth/sso.service';
import { Injectable } from '@nestjs/common';
import { ShowMethodAuthSettingsAdminObj } from 'vitnode-shared/admin/settings/auth.dto';

@Injectable()
export class ShowMethodsAuthSettingsAdminService {
  constructor(private readonly ssoAuthHelper: SSOAuthHelper) {}

  async show(): Promise<ShowMethodAuthSettingsAdminObj> {
    const [activeSSOs, enabledSSOs] = await Promise.all([
      this.ssoAuthHelper.getActiveSSOs(),
      this.ssoAuthHelper.getSSOs(),
    ]);

    return {
      edges: [
        {
          name: 'Standard',
          code: 'standard',
          enabled: true,
          client_id: '',
          client_secret: '',
        },
        ...activeSSOs,
      ],
      enabledMethods: [
        ...enabledSSOs.map(method => ({
          code: method.code,
          name: method.name,
        })),
      ],
    };
  }
}
