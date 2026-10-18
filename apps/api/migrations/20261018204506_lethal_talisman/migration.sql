ALTER INDEX "core_files_user_created_at_id_idx" RENAME TO "core_files_user_id_idx";--> statement-breakpoint
DROP INDEX "core_admin_sessions_expires_at_idx";--> statement-breakpoint
DROP INDEX "core_ai_runs_user_id_idx";--> statement-breakpoint
DROP INDEX "core_moderation_reports_created_at_id_idx";--> statement-breakpoint
DROP INDEX "core_notification_deliveries_event_idx";--> statement-breakpoint
DROP INDEX "core_queue_completed_at_idx";--> statement-breakpoint
DROP INDEX "core_sessions_expires_at_idx";--> statement-breakpoint
DROP INDEX "core_users_role_id_idx";--> statement-breakpoint
DROP INDEX "core_files_user_id_idx";--> statement-breakpoint
CREATE INDEX "core_files_user_id_idx" ON "core_files" ("userId");