import { CanActivate, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class OnlyForDevelopment implements CanActivate {
  canActivate(): boolean {
    if (process.env.NODE_ENV !== 'development') {
      throw new ForbiddenException(
        'This route is only available in development mode',
      );
    }

    return true;
  }
}
