import { Module } from "@nestjs/common";

import { ShowTopicsForumsResolver } from "./show/show.resolver";
import { ShowTopicsForumsService } from "./show/show.service";
import { CreateForumTopicsResolver } from "./create/create.resolver";
import { CreateForumTopicsService } from "./create/create.service";
import { PostsForumModule } from "../posts/posts.module";
import { ForumsForumModule } from "../forums/forums.module";
import { EditForumTopicsResolver } from "./edit/edit.resolver";
import { EditForumTopicsService } from "./edit/edit.service";

import { LockToggleForumTopicsResolver } from "@/modules/forum/topics/actions/lock_unlock/lock_toggle.resolver";
import { LockToggleForumTopicsService } from "@/modules/forum/topics/actions/lock_unlock/lock_toggle.service";

@Module({
  providers: [
    ShowTopicsForumsResolver,
    ShowTopicsForumsService,
    CreateForumTopicsResolver,
    CreateForumTopicsService,
    LockToggleForumTopicsResolver,
    LockToggleForumTopicsService,
    EditForumTopicsResolver,
    EditForumTopicsService
  ],
  imports: [PostsForumModule, ForumsForumModule]
})
export class TopicsForumModule {}
