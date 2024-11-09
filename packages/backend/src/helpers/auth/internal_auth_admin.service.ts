import { core_sessions_known_devices } from '@/database/schema/sessions';
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
export class InternalAuthAdminService {
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
    if (!req.headers['user-agent']) {
      throw new HttpException('User agent not found', HttpStatus.BAD_REQUEST);
    }
    const login_token: string =
      req.cookies[
        this.configService.getOrThrow('cookies.login_token.admin.name')
      ];

    const device = await this.deviceService.getDevice({
      req,
      res,
    });

    const session =
      await this.databaseService.db.query.core_admin_sessions.findFirst({
        where: (table, { eq, and, gt }) =>
          and(
            eq(table.login_token, login_token),
            eq(table.device_id, device.id),
            gt(table.expires_at, new Date()),
          ),
        with: {
          user: {
            columns: {
              email: true,
              newsletter: true,
            },
          },
        },
      });

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

    const decodeAccessToken = this.jwtService.decode(login_token);
    if (!decodeAccessToken || decodeAccessToken.exp < currentUnixDate()) {
      throw new ForbiddenException();
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

    return user;
  }
}
