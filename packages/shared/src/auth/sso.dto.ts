import { ApiProperty } from '@nestjs/swagger';

export class SSOUrlAuthObj {
  @ApiProperty()
  url: string;
}
