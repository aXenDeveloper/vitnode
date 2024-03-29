import { Field, Int, ObjectType } from "@nestjs/graphql";

import { PageInfo } from "@/types/database/pagination.type";

@ObjectType()
export class ShowCoreSessionDevicesObj {
  @Field(() => [ShowCoreSessionDevices])
  edges: ShowCoreSessionDevices[];

  @Field(() => PageInfo)
  pageInfo: PageInfo;
}

@ObjectType()
export class ShowCoreSessionDevices {
  @Field(() => Int)
  user_id: number;

  @Field(() => String)
  login_token: string;

  @Field(() => Date)
  last_seen: Date;

  @Field(() => Date)
  expires: Date;

  @Field(() => Int)
  device_id: number;
}
