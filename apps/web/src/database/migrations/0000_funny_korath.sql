CREATE TABLE "core_admin_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"roleId" integer,
	"userId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp NOT NULL,
	"protected" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_admin_permissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_admin_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" varchar(255) NOT NULL,
	"userId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"lastSeen" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"deviceId" integer NOT NULL,
	CONSTRAINT "core_admin_sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "core_admin_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_languages" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" varchar(255) NOT NULL,
	"timezone" varchar(255) DEFAULT 'UTC' NOT NULL,
	"protected" boolean DEFAULT false NOT NULL,
	"default" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp NOT NULL,
	"time24" boolean DEFAULT false NOT NULL,
	CONSTRAINT "core_languages_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "core_languages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_languages_words" (
	"id" serial PRIMARY KEY NOT NULL,
	"languageCode" varchar NOT NULL,
	"pluginCode" varchar(50) NOT NULL,
	"itemId" integer NOT NULL,
	"value" text NOT NULL,
	"tableName" varchar(255) NOT NULL,
	"variable" varchar(255) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_languages_words" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_moderators_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"roleId" integer,
	"userId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp NOT NULL,
	"protected" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_moderators_permissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp NOT NULL,
	"protected" boolean DEFAULT false NOT NULL,
	"default" boolean DEFAULT false NOT NULL,
	"root" boolean DEFAULT false NOT NULL,
	"guest" boolean DEFAULT false NOT NULL,
	"color" varchar(19)
);
--> statement-breakpoint
ALTER TABLE "core_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" varchar(255) NOT NULL,
	"userId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"deviceId" integer NOT NULL,
	CONSTRAINT "core_sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "core_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_sessions_known_devices" (
	"id" serial PRIMARY KEY NOT NULL,
	"ipAddress" varchar(40) NOT NULL,
	"userAgent" text NOT NULL,
	"lastSeen" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_sessions_known_devices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_test" (
	"id" serial PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"text" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_test" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"nameCode" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" varchar,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"newsletter" boolean DEFAULT false NOT NULL,
	"avatarColor" varchar(6) NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"roleId" integer NOT NULL,
	"birthday" timestamp,
	"ipAddress" varchar(40) NOT NULL,
	"language" varchar(32) DEFAULT 'en' NOT NULL,
	CONSTRAINT "core_users_nameCode_unique" UNIQUE("nameCode"),
	CONSTRAINT "core_users_name_unique" UNIQUE("name"),
	CONSTRAINT "core_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "core_users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_users_confirm_emails" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"token" varchar(100) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "core_users_confirm_emails_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "core_users_confirm_emails" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_users_forgot_password" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"token" varchar(100) NOT NULL,
	"ip_address" varchar(40) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp NOT NULL,
	CONSTRAINT "core_users_forgot_password_userId_unique" UNIQUE("userId"),
	CONSTRAINT "core_users_forgot_password_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "core_users_forgot_password" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "core_users_sso" (
	"userId" integer NOT NULL,
	"providerId" varchar(255) NOT NULL,
	"providerAccountId" varchar(255) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core_users_sso" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "core_admin_permissions" ADD CONSTRAINT "core_admin_permissions_roleId_core_roles_id_fk" FOREIGN KEY ("roleId") REFERENCES "public"."core_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_admin_permissions" ADD CONSTRAINT "core_admin_permissions_userId_core_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."core_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_admin_sessions" ADD CONSTRAINT "core_admin_sessions_userId_core_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."core_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_admin_sessions" ADD CONSTRAINT "core_admin_sessions_deviceId_core_sessions_known_devices_id_fk" FOREIGN KEY ("deviceId") REFERENCES "public"."core_sessions_known_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_languages_words" ADD CONSTRAINT "core_languages_words_languageCode_core_languages_code_fk" FOREIGN KEY ("languageCode") REFERENCES "public"."core_languages"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_moderators_permissions" ADD CONSTRAINT "core_moderators_permissions_roleId_core_roles_id_fk" FOREIGN KEY ("roleId") REFERENCES "public"."core_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_moderators_permissions" ADD CONSTRAINT "core_moderators_permissions_userId_core_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."core_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_sessions" ADD CONSTRAINT "core_sessions_userId_core_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."core_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_sessions" ADD CONSTRAINT "core_sessions_deviceId_core_sessions_known_devices_id_fk" FOREIGN KEY ("deviceId") REFERENCES "public"."core_sessions_known_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_users" ADD CONSTRAINT "core_users_roleId_core_roles_id_fk" FOREIGN KEY ("roleId") REFERENCES "public"."core_roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_users" ADD CONSTRAINT "core_users_language_core_languages_code_fk" FOREIGN KEY ("language") REFERENCES "public"."core_languages"("code") ON DELETE set default ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_users_confirm_emails" ADD CONSTRAINT "core_users_confirm_emails_userId_core_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."core_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_users_forgot_password" ADD CONSTRAINT "core_users_forgot_password_userId_core_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."core_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_users_sso" ADD CONSTRAINT "core_users_sso_userId_core_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."core_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "core_admin_permissions_role_id_idx" ON "core_admin_permissions" USING btree ("roleId");--> statement-breakpoint
CREATE INDEX "core_admin_permissions_user_id_idx" ON "core_admin_permissions" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "core_admin_sessions_token_idx" ON "core_admin_sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "core_admin_sessions_user_id_idx" ON "core_admin_sessions" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "core_languages_code_idx" ON "core_languages" USING btree ("code");--> statement-breakpoint
CREATE INDEX "core_languages_name_idx" ON "core_languages" USING btree ("name");--> statement-breakpoint
CREATE INDEX "core_languages_words_lang_code_idx" ON "core_languages_words" USING btree ("languageCode");--> statement-breakpoint
CREATE INDEX "core_moderators_permissions_role_id_idx" ON "core_moderators_permissions" USING btree ("roleId");--> statement-breakpoint
CREATE INDEX "core_moderators_permissions_user_id_idx" ON "core_moderators_permissions" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "core_sessions_user_id_idx" ON "core_sessions" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "core_sessions_known_devices_ip_address_idx" ON "core_sessions_known_devices" USING btree ("ipAddress");--> statement-breakpoint
CREATE INDEX "core_users_name_code_idx" ON "core_users" USING btree ("nameCode");--> statement-breakpoint
CREATE INDEX "core_users_name_idx" ON "core_users" USING btree ("name");--> statement-breakpoint
CREATE INDEX "core_users_email_idx" ON "core_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "core_users_sso_user_id_idx" ON "core_users_sso" USING btree ("userId");