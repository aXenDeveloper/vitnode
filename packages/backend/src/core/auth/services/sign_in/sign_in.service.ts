import { ConfigHelperService } from '@/helpers/config.service';
import { EmailHelperService } from '@/helpers/email/email.service';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { SignInAuthBody, SignInAuthObj } from 'vitnode-shared/auth/auth.dto';

import { verifyPassword } from '../../helpers/password';
import { SendConfirmEmailAuthService } from '../sign_up/send.confirm_email.service';
import { HelperSignInAuthService } from './helper.service';

@Injectable()
export class SignInAuthService {
  constructor(
    private readonly databaseService: InternalDatabaseService,
    private readonly signInHelper: HelperSignInAuthService,
    private readonly sendConfirmEmailCoreSessionsService: SendConfirmEmailAuthService,
    private readonly mailService: EmailHelperService,
    private readonly configHelper: ConfigHelperService,
  ) {}

  async singIn({
    req,
    res,
    body: { admin, email: emailRaw, password, ...rest },
  }: {
    body: SignInAuthBody;
    req: Request;
    res: Response;
  }): Promise<SignInAuthObj> {
    const config = await this.configHelper.getConfig();
    const email = emailRaw.toLowerCase();
    const user = await this.databaseService.db.query.core_users.findFirst({
      where: (table, { eq }) => eq(table.email, email),
      with: {
        confirm_email: true,
      },
      columns: {
        id: true,
        email_verified: true,
        group_id: true,
        name: true,
        password: true,
        language: true,
        name_seo: true,
        avatar_color: true,
        joined_at: true,
      },
    });
    if (!user?.password) {
      throw new ForbiddenException('ACCESS_DENIED');
    }

    const validPassword = await verifyPassword(password, user.password);
    if (!validPassword) {
      throw new ForbiddenException('ACCESS_DENIED');
    }

    if (
      !user.email_verified &&
      config.auth_require_confirm_email &&
      this.mailService.checkIfEnable()
    ) {
      await this.sendConfirmEmailCoreSessionsService.sendConfirmEmail({
        userId: user.id,
      });

      throw new HttpException('EMAIL_NOT_VERIFIED', HttpStatus.UNAUTHORIZED);
    }

    // If admin mode is enabled, check if user has access to admin cp
    if (admin) {
      const accessToAdminCP =
        await this.databaseService.db.query.core_admin_permissions.findFirst({
          where: (table, { eq, or }) =>
            or(
              user.group_id ? eq(table.group_id, user.group_id) : undefined,
              eq(table.user_id, user.id),
            ),
        });
      if (!accessToAdminCP) {
        throw new ForbiddenException('ACCESS_DENIED');
      }
    }

    const loginToken = await this.signInHelper.createSession({
      req,
      res,
      body: { admin, email, user_id: user.id, name: user.name, ...rest },
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...userWithoutPassword } = user;

    return {
      login_token: loginToken,
      ...userWithoutPassword,
    };
  }
}
