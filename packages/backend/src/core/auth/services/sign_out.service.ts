import { core_admin_sessions } from '@/database/schema/admins';
import { core_sessions } from '@/database/schema/sessions';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { Request, Response } from 'express';
import { SignOutAuthBody } from 'vitnode-shared/auth.dto';

@Injectable()
export class SignOutAuthService {
  constructor(
    private readonly databaseService: InternalDatabaseService,
    private readonly configService: ConfigService,
  ) {}

  async signOut({
    req,
    res,
    body: { is_admin },
  }: {
    body: SignOutAuthBody;
    req: Request;
    res: Response;
  }): Promise<void> {
    const login_token = req.cookies[
      this.configService.getOrThrow(
        `cookies.login_token.${is_admin ? 'admin.' : ''}name`,
      )
    ] as string;

    if (!login_token) return;

    if (is_admin) {
      await this.databaseService.db
        .update(core_admin_sessions)
        .set({
          expires_at: new Date(),
        })
        .where(eq(core_admin_sessions.login_token, login_token));
    } else {
      await this.databaseService.db
        .delete(core_sessions)
        .where(eq(core_sessions.login_token, login_token));
    }

    res.clearCookie(
      this.configService.getOrThrow(
        `cookies.login_token.${is_admin ? 'admin.' : ''}name`,
      ),
      {
        httpOnly: true,
        secure: !!this.configService.getOrThrow('cookies.secure'),
        domain: this.configService.getOrThrow('cookies.domain'),
        path: '/',
        sameSite: this.configService.getOrThrow('cookies.secure')
          ? 'none'
          : 'lax',
      },
    );

    res.clearCookie(
      this.configService.getOrThrow(
        `cookies.login_token.${is_admin ? 'admin.admin_id' : 'user_id'}`,
      ),
      {
        httpOnly: true,
        secure: !!this.configService.getOrThrow('cookies.secure'),
        domain: this.configService.getOrThrow('cookies.domain'),
        path: '/',
        sameSite: this.configService.getOrThrow('cookies.secure')
          ? 'none'
          : 'lax',
      },
    );
  }
}
