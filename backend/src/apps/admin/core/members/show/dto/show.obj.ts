import { Field, ObjectType } from "@nestjs/graphql";

import { PageInfo } from "@/types/database/pagination.type";
import { ShowCoreMembers } from "@/apps/core/members/show/dto/show.obj";

@ObjectType()
export class ShowAdminMembersObj {
  @Field(() => [ShowAdminMembers])
  edges: ShowAdminMembers[];

  @Field(() => PageInfo)
  pageInfo: PageInfo;
}

@ObjectType()
export class ShowAdminMembers extends ShowCoreMembers {
  @Field(() => String)
  email: string;

  @Field(() => Boolean)
  newsletter: boolean;
}