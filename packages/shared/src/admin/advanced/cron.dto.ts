import { ApiProperty } from '@nestjs/swagger';

export class ShowCronAdvancedAdmin {
  @ApiProperty({ nullable: true })
  last_execution: Date | null;

  @ApiProperty()
  name: string;

  @ApiProperty()
  next_date: Date;

  @ApiProperty()
  running: boolean;

  @ApiProperty()
  schedule: string;
}

export class ShowCronAdvancedAdminObj {
  @ApiProperty({ type: [ShowCronAdvancedAdmin] })
  edges: ShowCronAdvancedAdmin[];
}
