import { Module } from "@nestjs/common";

import { ShowTopicsForumsResolver } from "./show/show.resolver";
import { ShowTopicsForumsService } from "./show/show.service";
import { CreateForumTopicsResolver } from "./create/create.resolver";
import { CreateForumTopicsService } from "./create/create.service";
import { PostsForumModule } from "../posts/topics.module";
import { ForumsForumModule } from "../forums/forums.module";
import { EditForumTopicsResolver } from "./edit/edit.resolver";
import { EditForumTopicsService } from "./edit/edit.service";

import { LockToggleForumTopicsResolver } from "@/plugins/forum/topics/actions/lock_unlock/lock_toggle.resolver";
import { LockToggleForumTopicsService } from "@/plugins/forum/topics/actions/lock_unlock/lock_toggle.service";

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
