import type { Request, Response } from 'express';

import { core_users, core_users_sso_tokens } from '@/database/schema/users';
import { SSOAuthHelper } from '@/helpers/auth/sso.service';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { SSOCallbackAuthObj } from 'vitnode-shared/auth/sso.dto';

import { HelperSignInAuthService } from '../../services/sign_in/helper.service';

@Injectable()
export class CallbackSSOAuthService {
  constructor(
    private readonly ssoHelper: SSOAuthHelper,
    private readonly configService: ConfigService,
    private readonly databaseService: InternalDatabaseService,
    private readonly signInHelper: HelperSignInAuthService,
  ) {}

  async callbackSSO({
    provider,
    code,
    req,
    res,
  }: {
    code: string;
    provider: string;
    req: Request;
    res: Response;
  }): Promise<SSOCallbackAuthObj> {
    const frontendUrl: string = this.configService.getOrThrow('frontend_url');
    const redirectUri = (code: string) =>
      `${frontendUrl}/login/sso/${code}/callback`;
    const ssoProvider = this.ssoHelper.getSSO(provider);
    if (!ssoProvider.enabled) {
      throw new ForbiddenException('SSO provider not enabled');
    }

    const { access_token } = await ssoProvider.callback({
      client_id:
        '1067408430287-igio7a4koou4i26n8vvmqo4eqtcp9gka.apps.googleusercontent.com',
      client_secret: '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',
      redirect_uri: redirectUri(provider),
      code,
    });
    const data = await ssoProvider.registerCallback({ access_token });

    if (!data.verified_email) {
      throw new ForbiddenException('Email not verified');
    }

    const sso =
      await this.databaseService.db.query.core_users_sso_tokens.findFirst({
        where: (table, { eq, and }) =>
          and(eq(table.provider, provider), eq(table.provider_id, data.id)),
        with: {
          user: {
            columns: {
              id: true,
              email: true,
              name: true,
              language: true,
              name_seo: true,
              avatar_color: true,
            },
          },
        },
      });

    if (sso) {
      const loginToken = await this.signInHelper.createSession({
        req,
        res,
        body: {
          email: sso.user.email,
          user_id: sso.user.id,
          name: sso.user.name,
        },
      });

      return {
        login_token: loginToken,
        access_token,
        provider,
        provider_id: data.id,
        ...sso.user,
      };
    }

    const user = await this.databaseService.db.query.core_users.findFirst({
      where: (table, { eq }) => eq(table.email, data.email),
      columns: {
        id: true,
        email: true,
        name: true,
        language: true,
        name_seo: true,
        avatar_color: true,
        email_verified: true,
      },
    });
    // If user exists, create SSO token and sign in
    if (user) {
      if (!user.email_verified) {
        await this.databaseService.db
          .update(core_users)
          .set({
            email_verified: true,
          })
          .where(eq(core_users.id, user.id));
      }

      await this.databaseService.db.insert(core_users_sso_tokens).values({
        provider,
        provider_id: data.id,
        user_id: user.id,
      });

      const loginToken = await this.signInHelper.createSession({
        req,
        res,
        body: {
          email: user.email,
          user_id: user.id,
          name: user.name,
        },
      });

      return {
        access_token,
        login_token: loginToken,
        provider,
        provider_id: data.id,
        ...user,
      };
    }

    return {
      access_token,
      login_token: '',
      id: 0,
      name: data.name,
      language: 'en',
      name_seo: '',
      avatar_color: '',
      provider,
      provider_id: data.id,
    };
  }
}
