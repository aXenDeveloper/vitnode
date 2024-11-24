import { SSOAuthHelper } from '@/helpers/auth/sso.service';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SSOUrlAuthObj } from 'vitnode-shared/auth/sso.dto';

@Injectable()
export class GetUrlSSOAuthService {
  constructor(
    private readonly ssoHelper: SSOAuthHelper,
    private readonly configService: ConfigService,
  ) {}

  getUrlSSO(provider: string): SSOUrlAuthObj {
    const frontendUrl: string = this.configService.getOrThrow('frontend_url');
    const redirectUri = (code: string) =>
      `${frontendUrl}/login/sso/${code}/callback`;

    return this.ssoHelper.getSSO(provider).getUrl({
      redirect_uri: redirectUri(provider),
      client_id:
        '1067408430287-igio7a4koou4i26n8vvmqo4eqtcp9gka.apps.googleusercontent.com',
    });
  }
}
