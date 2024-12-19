import { core_users } from '@/database/schema/users';
import { InternalDatabaseService } from '@/utils/database/internal_database.service';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { VerifyConfirmEmailAuthQuery } from 'vitnode-shared/auth/auth.dto';

@Injectable()
export class VerifyConfirmEmailAuthService {
  constructor(private readonly databaseService: InternalDatabaseService) {}

  private async verifyToken(email: string, hash: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const [salt, key] = hash.split(':');
      crypto.scrypt(email, salt, 32, (err, derivedKey) => {
        if (err) reject(err);
        resolve(key == derivedKey.toString('hex'));
      });
    });
  }

  async verify({ token, user_id }: VerifyConfirmEmailAuthQuery): Promise<void> {
    const data =
      await this.databaseService.db.query.core_users_confirm_emails.findFirst({
        where: (table, { eq, and }) =>
          and(eq(table.token, token), eq(table.user_id, user_id)),
      });

    if (!data) {
      throw new HttpException('Token not found', HttpStatus.NOT_FOUND);
    }

    const validToken = await this.verifyToken(
      data.user_id.toString(),
      data.token,
    );
    if (!validToken) {
      throw new HttpException('Token is invalid', HttpStatus.BAD_REQUEST);
    }

    await this.databaseService.db
      .update(core_users)
      .set({
        email_verified: true,
      })
      .where(eq(core_users.id, user_id));
  }
}
