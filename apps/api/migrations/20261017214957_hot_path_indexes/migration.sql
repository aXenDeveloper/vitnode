DROP INDEX "core_files_user_id_idx";--> statement-breakpoint
CREATE INDEX "core_admin_sessions_expires_at_idx" ON "core_admin_sessions" ("expiresAt");--> statement-breakpoint
CREATE INDEX "core_ai_runs_user_id_idx" ON "core_ai_runs" ("userId","id");--> statement-breakpoint
CREATE INDEX "core_files_user_created_at_id_idx" ON "core_files" ("userId","createdAt","id");--> statement-breakpoint
CREATE INDEX "core_moderation_reports_created_at_id_idx" ON "core_moderation_reports" ("createdAt","id");--> statement-breakpoint
CREATE INDEX "core_notification_deliveries_event_idx" ON "core_notification_deliveries" ("eventId") WHERE "eventId" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "core_queue_completed_at_idx" ON "core_queue" ("completedAt") WHERE "completedAt" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "core_sessions_expires_at_idx" ON "core_sessions" ("expiresAt");--> statement-breakpoint
CREATE INDEX "core_users_role_id_idx" ON "core_users" ("roleId");