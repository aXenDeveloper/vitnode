import { INestApplication, NestApplicationOptions } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { nestFactoryOptions, nestjsMainApp } from 'vitnode-backend/main';

import { AppModule } from './app.module';

async function bootstrap() {
  const options: NestApplicationOptions = nestFactoryOptions;
  const app: INestApplication = await NestFactory.create(AppModule, options);

  void nestjsMainApp(app, {});
}
void bootstrap();
