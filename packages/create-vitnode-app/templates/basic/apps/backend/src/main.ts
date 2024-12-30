import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { nestFactoryOptions, nestjsMainApp } from 'vitnode-backend/main';

import { AppModule } from './app.module';

async function bootstrap() {
  const app: INestApplication = await NestFactory.create(
    AppModule,
    nestFactoryOptions,
  );

  void nestjsMainApp(app, {});
}
void bootstrap();
