import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { User, UserWithDangerousInfo } from 'vitnode-shared/user.dto';

export interface IOAuthGuards {
  authorization: (context: {
    req: Request;
    res: Response;
  }) => Promise<UserWithDangerousInfo>;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject('IOAuthGuards') private readonly service: IOAuthGuards,
  ) {}

  protected async getAuth(context: { req: Request; res: Response }) {
    const data = await this.service.authorization(context);

    (context.req as { user: User } & Request).user = data;

    return data;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const optionalAuth = this.reflector.get(OptionalAuth, context.getHandler());
    const req: Request = context.switchToHttp().getRequest();
    const res: Response = context.switchToHttp().getResponse();

    // If optional auth decorator is not set, check auth
    if (optionalAuth === undefined) {
      return !!(await this.getAuth({ req, res }));
    } else {
      try {
        return !!(await this.getAuth({ req, res }));
      } catch (_) {
        // Return true if auth is optional
        return true;
      }
    }
  }
}

export const OptionalAuth = Reflector.createDecorator();
