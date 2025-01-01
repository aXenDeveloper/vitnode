import {
  AdminPermission,
  AdminPermissionType,
} from '@/helpers/auth/admin-permission.decorator';
import { UserHelper } from '@/helpers/user.service';
import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { User, UserWithDangerousInfo } from 'vitnode-shared/user.dto';

import { type IOAuthGuards } from './auth.guard';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    @Inject('IOAdminAuthGuards') private readonly service: IOAuthGuards,
    private readonly reflector: Reflector,
    private readonly userHelper: UserHelper,
  ) {}

  protected async checkPermission({
    user,
    permission,
  }: {
    permission: AdminPermissionType;
    user: UserWithDangerousInfo;
  }) {
    const permissions = await this.userHelper.getUserAdminPermission({ user });

    if (permissions.length === 0) return true;
    const findPlugin = permissions.find(
      item => item.plugin_code === permission.plugin_code,
    );
    const findGroup = findPlugin?.groups.find(
      item => item.id === permission.group,
    );
    if (findGroup?.permissions.length === 0) return true;
    const findPermission = findGroup?.permissions.find(
      item => item === permission.permission,
    );

    return !!findPermission;
  }

  protected async getAuth(context: { req: Request; res: Response }) {
    const data = await this.service.authorization(context);

    (context.req as Request & { user: User }).user = data;

    return data;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req: Request = context.switchToHttp().getRequest();
    const res: Response = context.switchToHttp().getResponse();
    const permission =
      this.reflector.get(AdminPermission, context.getHandler()) ?? '';

    try {
      const user = await this.getAuth({ req, res });
      if (permission) {
        const isValid = await this.checkPermission({ user, permission });

        if (!isValid) {
          return false;
        }
      }

      return true;
    } catch (_) {
      return false;
    }
  }
}
