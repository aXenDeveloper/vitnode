ALTER TABLE "core_roles" ADD COLUMN "allowUploadFiles" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "core_roles" ADD COLUMN "totalMaxStorage" integer;--> statement-breakpoint
ALTER TABLE "core_roles" ADD COLUMN "maxStorageForSubmit" integer;