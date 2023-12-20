import { Injectable } from '@nestjs/common';

import { Ctx } from '@/types/context.type';
import { CONFIG } from '@/config';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class SignOutCoreSessionsService {
  constructor(private prisma: PrismaService) {}

  async signOut({ req, res }: Ctx) {
    const login_token = req.cookies[CONFIG.cookies.login_token.name];

    if (!login_token) {
      return 'You are not logged in';
    }

    await this.prisma.core_sessions.delete({
      where: {
        login_token
      }
    });

    res.clearCookie(CONFIG.cookies.login_token.name, {
      httpOnly: true,
      secure: true,
      domain: CONFIG.cookie.domain,
      path: '/',
      sameSite: 'none'
    });

    return 'You are logged out';
  }
}
