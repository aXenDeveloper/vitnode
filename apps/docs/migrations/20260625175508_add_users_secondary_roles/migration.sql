CREATE TABLE "core_users_secondary_roles" (
	"userId" integer NOT NULL,
	"roleId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "core_users_secondary_roles_userId_roleId_pk" PRIMARY KEY("userId","roleId")
);
--> statement-breakpoint
ALTER TABLE "core_users_secondary_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "core_users_secondary_roles" ADD CONSTRAINT "core_users_secondary_roles_userId_core_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."core_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core_users_secondary_roles" ADD CONSTRAINT "core_users_secondary_roles_roleId_core_roles_id_fk" FOREIGN KEY ("roleId") REFERENCES "public"."core_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "core_users_secondary_roles_user_id_idx" ON "core_users_secondary_roles" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "core_users_secondary_roles_role_id_idx" ON "core_users_secondary_roles" USING btree ("roleId");