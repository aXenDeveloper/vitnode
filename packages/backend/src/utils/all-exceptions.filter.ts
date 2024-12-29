import { core_logs } from '@/database/schema/logs';
import {
  ArgumentsHost,
  Catch,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';

import { InternalDatabaseService } from './database/internal_database.service';

@Catch()
@Injectable()
export class AllExceptionsFilter extends BaseExceptionFilter {
  constructor(private readonly databaseService: InternalDatabaseService) {
    super();
  }

  async catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();

    if (!(exception instanceof HttpException)) {
      const unCatchError = exception as Error;

      await this.databaseService.db.insert(core_logs).values({
        name: 'Internal Server Error',
        message: unCatchError.message,
        status: 500,
        headers: JSON.parse(JSON.stringify(request.headers)),
        method: request.method,
        url: request.url,
      });

      super.catch(exception, host);

      return;
    }

    if (!exception.message.includes('InternalServerErrorException')) {
      super.catch(exception, host);

      return;
    }

    await this.databaseService.db.insert(core_logs).values({
      name: 'InternalServerErrorException',
      message: exception.message,
      status: exception.getStatus(),
      headers: JSON.parse(JSON.stringify(request.headers)),
      method: request.method,
      url: request.url,
    });

    super.catch(exception, host);
  }
}
