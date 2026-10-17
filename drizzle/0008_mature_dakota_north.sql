ALTER TABLE "tenders" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tenders" ADD COLUMN "archived_by" uuid;--> statement-breakpoint
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_archived_by_profiles_id_fk" FOREIGN KEY ("archived_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;