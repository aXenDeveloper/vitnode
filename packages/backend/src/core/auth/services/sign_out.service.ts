import { core_sessions } from '@/database/schema/sessions';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { Request, Response } from 'express';

@Injectable()
export class SignOutAuthService {
  constructor(
    private readonly databaseService: InternalDatabaseService,
    private readonly configService: ConfigService,
  ) {}

  async signOut({ req, res }: { req: Request; res: Response }): Promise<void> {
    const login_token = req.cookies[
      this.configService.getOrThrow('cookies.login_token.name')
    ] as string;

    if (!login_token) return;

    await this.databaseService.db
      .delete(core_sessions)
      .where(eq(core_sessions.login_token, login_token));

    res.clearCookie(this.configService.getOrThrow('cookies.login_token.name'), {
      httpOnly: true,
      secure: !!this.configService.getOrThrow('cookies.secure'),
      domain: this.configService.getOrThrow('cookies.domain'),
      path: '/',
      sameSite: this.configService.getOrThrow('cookies.secure')
        ? 'none'
        : 'lax',
    });

    res.clearCookie(
      this.configService.getOrThrow('cookies.login_token.user_id'),
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
