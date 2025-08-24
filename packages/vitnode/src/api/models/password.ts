import crypto from 'crypto';

export class PasswordModel {
  async encryptPassword(password: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const salt = crypto.randomBytes(8).toString('hex');

      crypto.scrypt(password, salt, 64, (err, derivedKey) => {
        if (err) reject(err);

        resolve(salt + ':' + derivedKey.toString('hex'));
      });
    });
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const [salt, key] = hash.split(':');
      const keyBuffer = Buffer.from(key, 'hex');

      crypto.scrypt(password, salt, 64, (err, derivedKey) => {
        if (err) reject(err);

        if (keyBuffer.length !== derivedKey.length) {
          crypto.timingSafeEqual(derivedKey, derivedKey);
          resolve(false);
        } else {
          const areEqual = crypto.timingSafeEqual(keyBuffer, derivedKey);
          resolve(areEqual);
        }
      });
    });
  }
}

export class ForgotPasswordTokenModel {
  generateResetToken() {
    return crypto.randomBytes(32).toString('base64url');
  }

  hashResetToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
