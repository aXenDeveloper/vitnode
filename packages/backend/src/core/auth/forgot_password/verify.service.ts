import { Injectable } from '@nestjs/common';
import crypto from 'crypto';

@Injectable()
export class VerifyForgotPasswordAuthService {
  async encryptToken(email: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const salt = crypto.randomBytes(4).toString('hex');

      crypto.scrypt(email, salt, 32, (err, derivedKey) => {
        if (err) reject(err);

        resolve(salt + ':' + derivedKey.toString('hex'));
      });
    });
  }

  async verifyToken({
    token,
    email,
  }: {
    email: string;
    token: string;
  }): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const [salt, key] = token.split(':');
      crypto.scrypt(email, salt, 32, (err, derivedKey) => {
        if (err) reject(err);
        resolve(key == derivedKey.toString('hex'));
      });
    });
  }
}
