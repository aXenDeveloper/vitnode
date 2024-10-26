import { core_sessions_known_devices } from '@/database/schema/sessions';
import { core_users } from '@/database/schema/users';
import { currentUnixDate, getUserAgentData, getUserIp } from '@/functions';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import { Request, Response } from 'express';
import { UserWithDangerousInfo } from 'vitnode-shared/user.dto';

import { UserHelper } from '../user.service';
import { DeviceAuthService } from './device.service';

@Injectable()
export class InternalAuthService {
  constructor(
    private readonly databaseService: InternalDatabaseService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly deviceService: DeviceAuthService,
    private readonly userHelper: UserHelper,
  ) {}

  async authorization({
    req,
    res,
  }: {
    req: Request;
    res: Response;
  }): Promise<UserWithDangerousInfo> {
    const login_token = req.cookies[
      this.configService.getOrThrow('cookies.login_token.name')
    ] as string;
    const know_device_id: number | undefined =
      +req.cookies[this.configService.getOrThrow('cookies.known_device.name')];
    if (!req.headers['user-agent']) {
      throw new HttpException('User agent not found', HttpStatus.BAD_REQUEST);
    }
    if (!login_token || !know_device_id) {
      throw new ForbiddenException();
    }

    const device = await this.deviceService.getDevice({
      req,
      res,
    });

    const session = await this.databaseService.db.query.core_sessions.findFirst(
      {
        where: (table, { eq, and, gt }) =>
          and(
            eq(table.login_token, login_token),
            eq(table.device_id, device.id),
            gt(table.expires, new Date()),
          ),
        columns: {
          user_id: true,
        },
        with: {
          user: {
            columns: {
              email: true,
              language: true,
            },
          },
          device: true,
        },
      },
    );

    if (!session) {
      throw new ForbiddenException();
    }

    const user = await this.userHelper.getUserById({
      id: session.user_id,
      withDangerousData: true,
    });

    if (!user) {
      throw new ForbiddenException();
    }

    const decodeAccessToken: {
      email: string;
      exp: number;
    } | null = this.jwtService.decode(login_token);
    if (
      !decodeAccessToken ||
      decodeAccessToken.exp < currentUnixDate() ||
      decodeAccessToken.email !== session.user.email
    ) {
      throw new ForbiddenException();
    }

    let languageToSet: string =
      (Array.isArray(req.headers['x-vitnode-user-language'])
        ? req.headers['x-vitnode-user-language'][0]
        : req.headers['x-vitnode-user-language']) ?? 'en';

    // Check if language exists
    const lang = await this.databaseService.db.query.core_languages.findMany({
      columns: {
        code: true,
        default: true,
      },
    });

    if (!lang.find(l => l.code === languageToSet)) {
      languageToSet = lang.find(l => l.default)?.code ?? 'en';
    }

    if (
      req.headers['x-vitnode-user-language'] &&
      session.user.language !== req.headers['x-vitnode-user-language'] &&
      languageToSet !== session.user.language
    ) {
      await this.databaseService.db
        .update(core_users)
        .set({
          language: languageToSet,
        })
        .where(eq(core_users.id, session.user_id));
    }

    // Update last seen
    await this.databaseService.db
      .update(core_sessions_known_devices)
      .set({
        last_seen: new Date(),
        ...getUserAgentData(req.headers['user-agent']),
        ip_address: getUserIp(req),
      })
      .where(eq(core_sessions_known_devices.id, device.id));

    // Update known device cookie
    const expires = new Date();
    const expiresInDeviceCookie: number = this.configService.getOrThrow(
      'cookies.known_device.expiresIn',
    );
    expires.setDate(expires.getDate() + expiresInDeviceCookie);
    res.cookie(
      this.configService.getOrThrow('cookies.known_device.name'),
      know_device_id,
      {
        httpOnly: true,
        secure: !!this.configService.getOrThrow('cookies.secure'),
        domain: this.configService.getOrThrow('cookies.domain'),
        path: '/',
        expires,
        sameSite: this.configService.getOrThrow('cookies.secure')
          ? 'none'
          : 'lax',
      },
    );

    return user;
  }
}
