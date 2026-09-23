CREATE INDEX "core_admin_permissions_updated_at_id_idx" ON "core_admin_permissions" ("updatedAt","id");--> statement-breakpoint
CREATE INDEX "core_cron_last_run_id_idx" ON "core_cron" ("lastRun","id");--> statement-breakpoint
CREATE INDEX "core_files_created_at_id_idx" ON "core_files" ("createdAt","id");--> statement-breakpoint
CREATE INDEX "core_logs_created_at_id_idx" ON "core_logs" ("createdAt","id");--> statement-breakpoint
CREATE INDEX "core_moderators_permissions_updated_at_id_idx" ON "core_moderators_permissions" ("updatedAt","id");--> statement-breakpoint
CREATE INDEX "core_queue_created_at_id_idx" ON "core_queue" ("createdAt","id");--> statement-breakpoint
CREATE INDEX "core_roles_updated_at_id_idx" ON "core_roles" ("updatedAt","id");--> statement-breakpoint
CREATE INDEX "core_users_created_at_id_idx" ON "core_users" ("createdAt","id");