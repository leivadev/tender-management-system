ALTER TABLE "profiles" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "archived_by" uuid;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_archived_by_profiles_id_fk" FOREIGN KEY ("archived_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;