import { UserWithDangerousInfo } from '@/user.dto';
import { ApiProperty } from '@nestjs/swagger';

export class ShowAuthAdminObj {
  @ApiProperty()
  restart_server: boolean;

  @ApiProperty()
  user: UserWithDangerousInfo;

  @ApiProperty()
  version_of_vitnode: string;
}
