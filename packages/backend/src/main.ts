/* eslint-disable no-console */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { readFile } from 'fs/promises';
import helmet from 'helmet';
import { join } from 'path';

interface CorsOptionsMain extends Omit<CorsOptions, 'credentials'> {
  origin?: (RegExp | string)[];
}

interface Args {
  cors?: CorsOptionsMain;
}

export const nestjsMainApp = async (app: INestApplication, options?: Args) => {
  const pkg: {
    version: string;
  } = JSON.parse(await readFile(join(process.cwd(), 'package.json'), 'utf-8'));

  app.use(cookieParser());
  app.use(
    helmet({
      contentSecurityPolicy:
        process.env.NODE_ENV === 'development' ? false : undefined,
    }),
  );

  if (process.env.NODE_ENV === 'development') {
    const config = new DocumentBuilder()
      .setTitle('VitNode App')
      .setVersion(pkg.version)
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document, {
      jsonDocumentUrl: '/api/swagger.json',
    });
  }

  // Class Validation
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      enableDebugMessages: process.env.NODE_ENV === 'development',
    }),
  );

  app.enableCors({
    ...options?.cors,
    credentials: true,
    origin: [
      process.env.NEXT_PUBLIC_FRONTEND_URL
        ? process.env.NEXT_PUBLIC_FRONTEND_URL
        : 'http://localhost:3000',
      ...(options?.cors?.origin ?? []),
    ],
  });

  const port = Number(process.env.PORT) || 8080;
  const hostname = process.env.HOSTNAME ?? 'localhost';
  await app.listen(port, hostname, () => {
    const initConsole = '\x1b[34m[VitNode]\x1b[0m';

    console.log(
      initConsole,
      `Backend is running on: http://${hostname}:${port}/`,
    );
    console.log(
      initConsole,
      `Swagger is running on: http://${hostname}:${port}/api`,
    );
  });
};
