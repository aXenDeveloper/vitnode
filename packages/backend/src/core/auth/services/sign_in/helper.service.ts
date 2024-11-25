import { core_admin_sessions } from '@/database/schema/admins';
import { core_sessions } from '@/database/schema/sessions';
import { DeviceAuthService } from '@/helpers/auth/device.service';
import { EmailHelperService } from '@/helpers/email/email.service';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { and, eq } from 'drizzle-orm';
import { Request, Response } from 'express';
import { SignInAuthBody } from 'vitnode-shared/auth/auth.dto';

import { SendConfirmEmailAuthService } from '../sign_up/send.confirm_email.service';

@Injectable()
export class HelperSignInAuthService {
  constructor(
    private readonly databaseService: InternalDatabaseService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly deviceService: DeviceAuthService,
    private readonly sendConfirmEmailCoreSessionsService: SendConfirmEmailAuthService,
    private readonly mailService: EmailHelperService,
  ) {}

  async createSession({
    req,
    res,
    body: { email, admin, user_id, name },
  }: {
    body: { name: string; user_id: number } & Omit<SignInAuthBody, 'password'>;
    req: Request;
    res: Response;
  }) {
    const loginTokenSecret: string =
      this.configService.getOrThrow('login_token_secret');
    const devMode: boolean = this.configService.get('dev_mode') ?? false;
    const device = await this.deviceService.getDevice({ req, res });
    if (device.uagent_os === 'Uagent from tests' && !devMode) {
      throw new ForbiddenException('ACCESS_DENIED');
    }

    const login_token = this.jwtService.sign(
      {
        name,
        email,
      },
      {
        secret: loginTokenSecret,
        expiresIn:
          60 *
          60 *
          24 *
          this.configService.getOrThrow('cookies.login_token.expiresIn'),
      },
    );

    const expiresValue: number = this.configService.getOrThrow(
      'cookies.login_token.expiresIn',
    );

    if (admin) {
      const expires_at = new Date();
      // Admin session expires in 3 hours
      expires_at.setHours(expires_at.getHours() + 3);

      const activeSession =
        await this.databaseService.db.query.core_admin_sessions.findFirst({
          where: (table, { eq, and }) =>
            and(eq(table.user_id, user_id), eq(table.device_id, device.id)),
        });

      if (activeSession) {
        await this.databaseService.db
          .update(core_admin_sessions)
          .set({
            login_token,
            expires_at,
          })
          .where(
            and(
              eq(core_admin_sessions.user_id, user_id),
              eq(core_admin_sessions.device_id, device.id),
            ),
          );
      } else {
        await this.databaseService.db.insert(core_admin_sessions).values({
          login_token,
          user_id,
          expires_at,
          device_id: device.id,
        });
      }

      // Set cookie for session
      res.cookie(
        this.configService.getOrThrow('cookies.login_token.admin.name'),
        login_token,
        {
          httpOnly: true,
          secure: !!this.configService.getOrThrow('cookies.secure'),
          domain: this.configService.getOrThrow('cookies.domain'),
          path: '/',
          expires: expires_at,
          sameSite: this.configService.getOrThrow('cookies.secure')
            ? 'none'
            : 'lax',
        },
      );

      res.cookie(
        this.configService.getOrThrow('cookies.login_token.admin.admin_id'),
        user_id,
        {
          httpOnly: true,
          secure: !!this.configService.getOrThrow('cookies.secure'),
          domain: this.configService.getOrThrow('cookies.domain'),
          path: '/',
          expires: expires_at,
          sameSite: this.configService.getOrThrow('cookies.secure')
            ? 'none'
            : 'lax',
        },
      );

      return login_token;
    }

    const expires_at = new Date();
    expires_at.setDate(expires_at.getDate() + expiresValue);

    // Check if user has an active session in the same device
    const activeSession =
      await this.databaseService.db.query.core_sessions.findFirst({
        where: (table, { eq, and }) =>
          and(eq(table.user_id, user_id), eq(table.device_id, device.id)),
      });

    if (activeSession) {
      await this.databaseService.db
        .update(core_sessions)
        .set({
          login_token,
          expires_at,
        })
        .where(
          and(
            eq(core_sessions.user_id, user_id),
            eq(core_sessions.device_id, device.id),
          ),
        );
    } else {
      await this.databaseService.db.insert(core_sessions).values({
        login_token,
        user_id,
        expires_at,
        device_id: device.id,
      });
    }

    // Set cookie for session
    res.cookie(
      this.configService.getOrThrow('cookies.login_token.name'),
      login_token,
      {
        httpOnly: true,
        secure: !!this.configService.getOrThrow('cookies.secure'),
        domain: this.configService.getOrThrow('cookies.domain'),
        path: '/',
        expires: expires_at,
        sameSite: this.configService.getOrThrow('cookies.secure')
          ? 'none'
          : 'lax',
      },
    );
    res.cookie(
      this.configService.getOrThrow('cookies.login_token.user_id'),
      user_id,
      {
        httpOnly: true,
        secure: !!this.configService.getOrThrow('cookies.secure'),
        domain: this.configService.getOrThrow('cookies.domain'),
        path: '/',
        expires: expires_at,
        sameSite: this.configService.getOrThrow('cookies.secure')
          ? 'none'
          : 'lax',
      },
    );

    return login_token;
  }
}
