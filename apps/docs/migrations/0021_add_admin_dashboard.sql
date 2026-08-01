CREATE TABLE "core_admin_dashboard" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"widgets" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "core_admin_dashboard_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
ALTER TABLE "core_admin_dashboard" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "core_admin_dashboard" ADD CONSTRAINT "core_admin_dashboard_userId_core_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."core_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "core_admin_dashboard_user_id_idx" ON "core_admin_dashboard" USING btree ("userId");