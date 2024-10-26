import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { UserWithDangerousInfo } from 'vitnode-shared/user.dto';

export interface IOAuthGuards {
  authorization: (context: {
    req: Request;
    res: Response;
  }) => Promise<UserWithDangerousInfo>;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject('IOAuthGuards') private readonly service: IOAuthGuards) {}

  protected async getAuth(context: { req: Request; res: Response }) {
    return await this.service.authorization(context);
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
