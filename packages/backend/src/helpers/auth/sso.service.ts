import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SSOUrlAuthObj } from 'vitnode-shared/auth/sso.dto';

export interface SSOAuthItem {
  name: string;
  enabled: boolean;
  getUrl: () => SSOUrlAuthObj;
  code: string;
}

@Injectable()
export class SSOAuthHelper {
  constructor(private readonly configService: ConfigService) {}

  getSSO(code: string): SSOAuthItem {
    const item = this.getSSOs().find(sso => sso.code === code);
    if (!item) {
      throw new NotFoundException(`SSO provider with ${code} code not found`);
    }

    return item;
  }

  getSSOs(): SSOAuthItem[] {
    const frontendUrl: string = this.configService.getOrThrow('frontend_url');
    const redirectUri = (code: string) =>
      `${frontendUrl}/login/sso/${code}/callback`;

    return [
      {
        name: 'Google',
        code: 'google',
        enabled: true,
        getUrl: () => {
          const params = new URLSearchParams({
            client_id:
              '1067408430287-igio7a4koou4i26n8vvmqo4eqtcp9gka.apps.googleusercontent.com',
            redirect_uri: redirectUri('google'),
            response_type: 'code',
            scope: 'openid profile email',
          });

          return {
            url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
          };
        },
      },
    ];
  }
}
