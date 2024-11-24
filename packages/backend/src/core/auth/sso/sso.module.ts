import { Module } from '@nestjs/common';
import { SSOAuthController } from './sso.controller';

@Module({
  controllers: [SSOAuthController],
})
export class SSOAuthModule {}
