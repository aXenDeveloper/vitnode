import type { LanguageModel } from 'ai';

import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class AiHelperService {
  constructor(
    @Inject('VITNODE_MODEL_AI') private readonly aiModel?: LanguageModel,
  ) {}

  getModel(): LanguageModel | undefined {
    return this.aiModel;
  }
}
