import { type IOAuthGuards } from '@/guards/auth.guard';
import { Inject, Injectable } from '@nestjs/common';
import { Request, Response } from 'express';
import { ShowAuthObj } from 'vitnode-shared/auth.dto';
import { UserWithDangerousInfo } from 'vitnode-shared/user.dto';

@Injectable()
export class ShowAuthService {
  constructor(
    @Inject('IOAuthGuards') private readonly authService: IOAuthGuards,
  ) {}

  async show({
    req,
    res,
  }: {
    req: Request;
    res: Response;
  }): Promise<ShowAuthObj> {
    let user: null | UserWithDangerousInfo = null;
    try {
      user = await this.authService.authorization({
        req,
        res,
      });
    } catch (err) {
      const error = err as { status: number };
      if (error.status !== 403) {
        throw err;
      }
    }

    return {
      user,
    };
  }
}
