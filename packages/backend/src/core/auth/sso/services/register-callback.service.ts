import type { Request, Response } from 'express';

import { core_users } from '@/database/schema/users';
import { getUserIp, removeSpecialCharacters } from '@/functions';
import { SSOAuthHelper } from '@/helpers/auth/sso/sso.service';
import { ConfigHelperService } from '@/helpers/config.service';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  RegisterSSOCallbackAuthBody,
  SSOCallbackAuthObj,
} from 'vitnode-shared/auth/sso.dto';

import { generateAvatarColor } from '../../helpers/avatar-color';
import { HelperSignInAuthService } from '../../services/sign_in/helper.service';
import { HelperSignUpAuthService } from '../../services/sign_up/helper.service';

@Injectable()
export class RegisterCallbackSSOAuthService {
  constructor(
    private readonly databaseService: InternalDatabaseService,
    private readonly ssoAuthHelper: SSOAuthHelper,
    private readonly signUpHelper: HelperSignUpAuthService,
    private readonly signInHelper: HelperSignInAuthService,
    private readonly configHelper: ConfigHelperService,
  ) {}

  async registerCallbackSSO({
    provider,
    body: { name, access_token, provider_id },
    req,
    res,
  }: {
    body: RegisterSSOCallbackAuthBody;
    provider: string;
    req: Request;
    res: Response;
  }): Promise<SSOCallbackAuthObj> {
    const config = await this.configHelper.getConfig();
    if (config.auth_lock_register) {
      throw new ForbiddenException('Register is locked');
    }
    const sso = await this.ssoAuthHelper.getActiveSSO(provider);
    const data = await sso.registerCallback({ access_token });
    if (provider_id !== data.id) {
      throw new ConflictException('Provider id does not match');
    }

    const email = data.email.toLowerCase();
    const user = await this.databaseService.db.query.core_users.findFirst({
      where: (table, { eq }) => eq(table.email, email),
    });
    if (user) {
      throw new ConflictException('User already exists');
    }
    const convertToNameSEO = removeSpecialCharacters(name);
    const checkNameSEO =
      await this.databaseService.db.query.core_users.findFirst({
        where: (table, { eq }) => eq(table.name_seo, convertToNameSEO),
      });

    if (checkNameSEO) {
      throw new ConflictException('NAME_ALREADY_EXISTS');
    }

    const [createUser] = await this.databaseService.db
      .insert(core_users)
      .values({
        email,
        name,
        name_seo: convertToNameSEO,
        newsletter: false,
        avatar_color: generateAvatarColor(name),
        group_id: (await this.signUpHelper.getDefaultData()).group_id,
        email_verified: true,
        ip_address: getUserIp(req),
        language: await this.signUpHelper.getLanguage(req),
      })
      .returning();

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...rest } = createUser;

    const loginToken = await this.signInHelper.createSession({
      req,
      res,
      body: {
        email: createUser.email,
        user_id: createUser.id,
        name: createUser.name,
      },
    });

    return {
      login_token: loginToken,
      access_token,
      provider,
      provider_id,
      ...rest,
    };
  }
}
