import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { nestjsMainApp } from 'vitnode-backend/main';

import { AppModule } from './app.module';

async function bootstrap() {
  const app: INestApplication = await NestFactory.create(AppModule);

  void nestjsMainApp(app, {});
}
void bootstrap();
