DROP INDEX "core_admin_sessions_token_idx";--> statement-breakpoint
DROP INDEX "core_languages_code_idx";--> statement-breakpoint
DROP INDEX "core_users_name_code_idx";--> statement-breakpoint
DROP INDEX "core_users_name_idx";--> statement-breakpoint
DROP INDEX "core_users_email_idx";--> statement-breakpoint
DROP INDEX "core_users_secondary_roles_user_id_idx";--> statement-breakpoint
CREATE INDEX "core_admin_sessions_device_id_idx" ON "core_admin_sessions" ("deviceId");--> statement-breakpoint
CREATE INDEX "core_languages_words_lookup_idx" ON "core_languages_words" ("tableName","pluginCode","variable","itemId");--> statement-breakpoint
CREATE INDEX "core_logs_user_id_idx" ON "core_logs" ("userId");--> statement-breakpoint
CREATE INDEX "core_sessions_device_id_idx" ON "core_sessions" ("deviceId");