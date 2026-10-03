ALTER TABLE "core_logs" DROP COLUMN "test123";--> statement-breakpoint
ALTER TABLE "core_logs" ALTER COLUMN "userId" SET DATA TYPE integer USING "userId"::integer;