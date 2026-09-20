ALTER TABLE "core_navigation" ADD COLUMN "parentId" integer;--> statement-breakpoint
CREATE INDEX "core_navigation_parent_idx" ON "core_navigation" ("parentId");--> statement-breakpoint
ALTER TABLE "core_navigation" ADD CONSTRAINT "core_navigation_parentId_core_navigation_id_fkey" FOREIGN KEY ("parentId") REFERENCES "core_navigation"("id") ON DELETE SET NULL;