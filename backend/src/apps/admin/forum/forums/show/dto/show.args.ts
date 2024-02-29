import { ArgsType, OmitType } from "@nestjs/graphql";

import { ShowForumForumsArgs } from "@/apps/forum/forums/show/dto/show.args";

@ArgsType()
export class ShowForumForumsAdminArgs extends OmitType(ShowForumForumsArgs, [
  "ids"
] as const) {}