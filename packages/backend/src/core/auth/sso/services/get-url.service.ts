import { SSOAuthHelper } from '@/helpers/auth/sso/sso.service';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SSOUrlAuthObj } from 'vitnode-shared/auth/sso.dto';

@Injectable()
export class GetUrlSSOAuthService {
  constructor(
    private readonly ssoHelper: SSOAuthHelper,
    private readonly configService: ConfigService,
  ) {}

  async getUrlSSO(provider: string): Promise<SSOUrlAuthObj> {
    const frontendUrl: string = this.configService.getOrThrow('frontend_url');
    const redirectUri = (code: string) =>
      `${frontendUrl}/login/sso/${code}/callback`;
    const sso = await this.ssoHelper.getActiveSSO(provider);

    return sso.getUrl({
      redirect_uri: redirectUri(provider),
      client_id: sso.client_id,
    });
  }
}
