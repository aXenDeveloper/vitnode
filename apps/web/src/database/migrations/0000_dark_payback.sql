CREATE TYPE "public"."vitnode_core_app_type" AS ENUM('website', 'article', 'book', 'music.album', 'music.playlist', 'music.radio_station', 'music.song', 'profile', 'video.episode', 'video.movie', 'video.tv_show');--> statement-breakpoint
CREATE TABLE "core_admin_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid,
	"user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"protected" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core_admin_sessions" (
	"token" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_seen" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"device_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core_config" (
	"app_type" "vitnode_core_app_type" DEFAULT 'website' NOT NULL,
	"restart_server" boolean DEFAULT false NOT NULL,
	"editor_sticky" boolean DEFAULT true NOT NULL,
	"site_name" varchar(150) DEFAULT 'VitNode' NOT NULL,
	"site_short_name" varchar(75) DEFAULT 'VitNode' NOT NULL,
	"contact_email" varchar DEFAULT '' NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	"auth_force_login" boolean DEFAULT false NOT NULL,
	"auth_lock_register" boolean DEFAULT false NOT NULL,
	"auth_require_confirm_email" boolean DEFAULT false NOT NULL,
	"admin_note" text DEFAULT 'Enter your note here. :)' NOT NULL,
	"admin_note_updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"protected" boolean DEFAULT false NOT NULL,
	"default" boolean DEFAULT false NOT NULL,
	"root" boolean DEFAULT false NOT NULL,
	"guest" boolean DEFAULT false NOT NULL,
	"color" varchar(19),
	"files_allow_upload" boolean DEFAULT true NOT NULL,
	"files_total_max_storage" integer DEFAULT 500000 NOT NULL,
	"files_max_storage_for_submit" integer DEFAULT 5000 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core_languages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" varchar(255) NOT NULL,
	"timezone" varchar(255) DEFAULT 'UTC' NOT NULL,
	"protected" boolean DEFAULT false NOT NULL,
	"default" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"time_24" boolean DEFAULT false NOT NULL,
	"allow_in_input" boolean DEFAULT true NOT NULL,
	CONSTRAINT "core_languages_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "core_languages_words" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"language_code" varchar NOT NULL,
	"plugin_code" varchar(50) NOT NULL,
	"item_id" varchar NOT NULL,
	"value" text NOT NULL,
	"table_name" varchar(255) NOT NULL,
	"variable" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core_moderators_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid,
	"user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"protected" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core_sessions" (
	"token" varchar(255) NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"device_id" uuid NOT NULL,
	CONSTRAINT "core_sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "core_sessions_known_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip_address" varchar(40) NOT NULL,
	"user_agent" text NOT NULL,
	"last_seen" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_code" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" varchar,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"newsletter" boolean DEFAULT false NOT NULL,
	"avatar_color" varchar(6) NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"group_id" uuid NOT NULL,
	"birthday" timestamp,
	"ip_address" varchar(40) NOT NULL,
	"language" varchar(5) DEFAULT 'en' NOT NULL,
	CONSTRAINT "core_users_name_code_unique" UNIQUE("name_code"),
	CONSTRAINT "core_users_name_unique" UNIQUE("name"),
	CONSTRAINT "core_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "core_users_confirm_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "core_users_confirm_emails_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "core_users_forgot_password" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" varchar(100) NOT NULL,
	"ip_address" varchar(40) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "core_users_forgot_password_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "core_users_forgot_password_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "core_users_sso" (
	"user_id" uuid NOT NULL,
	"provider_id" varchar(255) NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_admin_permissions" ADD CONSTRAINT "core_admin_permissions_group_id_core_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."core_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_admin_permissions" ADD CONSTRAINT "core_admin_permissions_user_id_core_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."core_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_admin_sessions" ADD CONSTRAINT "core_admin_sessions_user_id_core_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."core_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_admin_sessions" ADD CONSTRAINT "core_admin_sessions_device_id_core_sessions_known_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."core_sessions_known_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_languages_words" ADD CONSTRAINT "core_languages_words_language_code_core_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "public"."core_languages"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_moderators_permissions" ADD CONSTRAINT "core_moderators_permissions_group_id_core_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."core_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_moderators_permissions" ADD CONSTRAINT "core_moderators_permissions_user_id_core_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."core_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_sessions" ADD CONSTRAINT "core_sessions_user_id_core_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."core_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_sessions" ADD CONSTRAINT "core_sessions_device_id_core_sessions_known_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."core_sessions_known_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_users" ADD CONSTRAINT "core_users_group_id_core_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."core_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_users" ADD CONSTRAINT "core_users_language_core_languages_code_fk" FOREIGN KEY ("language") REFERENCES "public"."core_languages"("code") ON DELETE set default ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_users_confirm_emails" ADD CONSTRAINT "core_users_confirm_emails_user_id_core_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."core_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_users_forgot_password" ADD CONSTRAINT "core_users_forgot_password_user_id_core_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."core_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_users_sso" ADD CONSTRAINT "core_users_sso_user_id_core_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."core_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "core_admin_permissions_group_id_idx" ON "core_admin_permissions" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "core_admin_permissions_user_id_idx" ON "core_admin_permissions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "core_admin_sessions_token_idx" ON "core_admin_sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "core_admin_sessions_user_id_idx" ON "core_admin_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "core_languages_code_idx" ON "core_languages" USING btree ("code");--> statement-breakpoint
CREATE INDEX "core_languages_name_idx" ON "core_languages" USING btree ("name");--> statement-breakpoint
CREATE INDEX "core_languages_words_lang_code_idx" ON "core_languages_words" USING btree ("language_code");--> statement-breakpoint
CREATE INDEX "core_moderators_permissions_group_id_idx" ON "core_moderators_permissions" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "core_moderators_permissions_user_id_idx" ON "core_moderators_permissions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "core_sessions_user_id_idx" ON "core_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "core_sessions_known_devices_ip_address_idx" ON "core_sessions_known_devices" USING btree ("ip_address");--> statement-breakpoint
CREATE INDEX "core_users_name_code_idx" ON "core_users" USING btree ("name_code");--> statement-breakpoint
CREATE INDEX "core_users_name_idx" ON "core_users" USING btree ("name");--> statement-breakpoint
CREATE INDEX "core_users_email_idx" ON "core_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "core_users_sso_user_id_idx" ON "core_users_sso" USING btree ("user_id");