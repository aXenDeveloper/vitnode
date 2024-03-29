import { Field, ObjectType } from "@nestjs/graphql";

import { AuthorizationCurrentUserObj } from "@/plugins/core/sessions/authorization/dto/authorization.obj";
@ObjectType()
export class RebuildRequiredObj {
  @Field(() => Boolean)
  themes: boolean;

  @Field(() => Boolean)
  langs: boolean;

  @Field(() => Boolean)
  plugins: boolean;
}

@ObjectType()
class ItemNavAdminPluginsAuthorization {
  @Field(() => String)
  code: string;

  @Field(() => String)
  href: string;

  @Field(() => String, { nullable: true })
  icon: string | null;
}

@ObjectType()
export class NavAdminPluginsAuthorization {
  @Field(() => String)
  code: string;

  @Field(() => [ItemNavAdminPluginsAuthorization])
  nav: ItemNavAdminPluginsAuthorization[];
}

@ObjectType()
export class AuthorizationAdminSessionsObj {
  @Field(() => AuthorizationCurrentUserObj, { nullable: true })
  user: AuthorizationCurrentUserObj | null;

  @Field(() => RebuildRequiredObj)
  rebuild_required: RebuildRequiredObj;

  @Field(() => String)
  version: string;

  @Field(() => [NavAdminPluginsAuthorization])
  nav: NavAdminPluginsAuthorization[];
}
