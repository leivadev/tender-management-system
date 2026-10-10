CREATE TYPE "public"."tender_status" AS ENUM('draft', 'active', 'finalized', 'for_collection', 'collected', 'lost');--> statement-breakpoint
-- Quantities were numeric(12,2). Existing fractional or sub-1 quantities are rounded to a whole
-- number >= 1 and the frozen subtotal is recomputed so lines stay internally consistent (BR-17).
UPDATE "tender_products"
SET "quantity" = GREATEST(round("quantity"), 1),
	"subtotal" = round(GREATEST(round("quantity"), 1) * "unit_price", 2)
WHERE "quantity" <> trunc("quantity") OR "quantity" < 1;--> statement-breakpoint
ALTER TABLE "tender_products" ALTER COLUMN "quantity" SET DATA TYPE integer USING "quantity"::integer;--> statement-breakpoint
ALTER TABLE "tender_status_history" ALTER COLUMN "from_status" SET DATA TYPE "public"."tender_status" USING "from_status"::"public"."tender_status";--> statement-breakpoint
ALTER TABLE "tender_status_history" ALTER COLUMN "to_status" SET DATA TYPE "public"."tender_status" USING "to_status"::"public"."tender_status";--> statement-breakpoint
ALTER TABLE "tenders" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "tenders" ALTER COLUMN "status" SET DATA TYPE "public"."tender_status" USING "status"::"public"."tender_status";--> statement-breakpoint
ALTER TABLE "tenders" ALTER COLUMN "status" SET DEFAULT 'draft';--> statement-breakpoint
CREATE INDEX "payments_tender_id_idx" ON "payments" USING btree ("tender_id");--> statement-breakpoint
CREATE INDEX "tender_products_product_id_idx" ON "tender_products" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "tender_status_history_tender_id_idx" ON "tender_status_history" USING btree ("tender_id");--> statement-breakpoint
CREATE INDEX "tenders_status_idx" ON "tenders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tenders_deadline_idx" ON "tenders" USING btree ("deadline");--> statement-breakpoint
CREATE INDEX "tenders_client_id_idx" ON "tenders" USING btree ("client_id");--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_name_length" CHECK (char_length("clients"."name") <= 200);--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_company_name_length" CHECK (char_length("clients"."company_name") <= 200);--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_email_length" CHECK (char_length("clients"."email") <= 254);--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_positive" CHECK ("payments"."amount" > 0);--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_reference_length" CHECK (char_length("payments"."reference") <= 100);--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_notes_length" CHECK (char_length("payments"."notes") <= 500);--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_unit_price_positive" CHECK ("products"."unit_price" > 0);--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_name_length" CHECK (char_length("products"."name") <= 200);--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_email_length" CHECK (char_length("profiles"."email") <= 254);--> statement-breakpoint
ALTER TABLE "tender_products" ADD CONSTRAINT "tender_products_quantity_min" CHECK ("tender_products"."quantity" >= 1);--> statement-breakpoint
ALTER TABLE "tender_products" ADD CONSTRAINT "tender_products_unit_price_positive" CHECK ("tender_products"."unit_price" > 0);--> statement-breakpoint
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_max_budget_positive" CHECK ("tenders"."max_budget" > 0);--> statement-breakpoint
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_invoice_amount_positive" CHECK ("tenders"."invoice_amount" is null or "tenders"."invoice_amount" > 0);--> statement-breakpoint
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_title_length" CHECK (char_length("tenders"."title") <= 200);--> statement-breakpoint
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_description_length" CHECK (char_length("tenders"."description") <= 5000);