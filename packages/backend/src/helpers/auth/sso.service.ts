import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SSOUrlAuthObj } from 'vitnode-shared/auth/sso.dto';

export interface SSOAuthCallbackObj {
  email: string;
  id: string;
  name: string;
  verified_email: boolean;
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
  enabled: boolean;
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
  getSSO(code: string): SSOAuthItem {
    const item = this.getSSOs().find(sso => sso.code === code);
    if (!item) {
      throw new NotFoundException(`SSO provider with ${code} code not found`);
    }

    return item;
  }

  getSSOs(): SSOAuthItem[] {
    return [
      {
        name: 'Google',
        code: 'google',
        enabled: true,
        getUrl: ({ redirect_uri, client_id }) => {
          const params = new URLSearchParams({
            client_id,
            redirect_uri,
            response_type: 'code',
            scope: 'openid profile email',
          });

          return {
            url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
          };
        },
        callback: async ({ client_id, client_secret, redirect_uri, code }) => {
          const body = {
            client_id,
            client_secret,
            code,
            grant_type: 'authorization_code',
            redirect_uri,
          };

          const res = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            body: JSON.stringify(body),
          });

          const tokenData: {
            access_token?: string;
          } = await res.json();
          if (!tokenData.access_token) {
            throw new ForbiddenException('Invalid token');
          }

          return {
            access_token: tokenData.access_token,
          };
        },
        registerCallback: async ({ access_token }) => {
          const res = await fetch(
            'https://www.googleapis.com/oauth2/v2/userinfo',
            {
              headers: {
                Authorization: `Bearer ${access_token}`,
              },
            },
          );

          const userInfo: {
            email: string;
            id: string;
            name: string;
            verified_email: boolean;
          } = await res.json();
          // console.log(userInfo);

          return {
            id: userInfo.id,
            name: userInfo.name,
            email: userInfo.email,
            verified_email: userInfo.verified_email,
          };
        },
      },
    ];
  }
}
