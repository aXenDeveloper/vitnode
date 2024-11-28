import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { User } from 'vitnode-shared/user.dto';

import { type IOAuthGuards } from './auth.guard';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    @Inject('IOAdminAuthGuards') private readonly service: IOAuthGuards,
  ) {}

  protected async getAuth(context: { req: Request; res: Response }) {
    const data = await this.service.authorization(context);

    (context.req as Request & { user: User }).user = data;

    return data;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req: Request = context.switchToHttp().getRequest();
    const res: Response = context.switchToHttp().getResponse();

    try {
      await this.getAuth({ req, res });

      return true;
    } catch (_) {
      return false;
    }
  }
}
