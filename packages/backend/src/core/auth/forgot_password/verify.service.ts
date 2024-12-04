import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { Injectable } from '@nestjs/common';
import crypto from 'crypto';

@Injectable()
export class VerifyForgotPasswordAuthService {
  constructor(private readonly databaseService: InternalDatabaseService) {}

  async encryptToken(email: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const salt = crypto.randomBytes(4).toString('hex');

      crypto.scrypt(email, salt, 32, (err, derivedKey) => {
        if (err) reject(err);

        resolve(salt + ':' + derivedKey.toString('hex'));
      });
    });
  }
}
