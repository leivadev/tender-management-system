-- Resolve pre-existing duplicates so the unique indexes can be created.
-- Products: keep the oldest name as is, suffix later ones with their id prefix.
UPDATE "products" p SET "name" = p."name" || ' [dup ' || left(p."id"::text, 8) || ']'
FROM (
	SELECT "id", row_number() OVER (PARTITION BY lower("name") ORDER BY "created_at", "id") AS rn
	FROM "products"
) d
WHERE p."id" = d."id" AND d.rn > 1;--> statement-breakpoint
-- Tender lines: fold repeated products into the oldest line, preserving the tender total.
UPDATE "tender_products" k SET "quantity" = s.quantity, "subtotal" = s.subtotal
FROM (
	SELECT min("id"::text)::uuid AS keep_id, sum("quantity") AS quantity, sum("subtotal") AS subtotal
	FROM "tender_products"
	GROUP BY "tender_id", "product_id"
	HAVING count(*) > 1
) s
WHERE k."id" = s.keep_id;--> statement-breakpoint
DELETE FROM "tender_products" t
USING (
	SELECT "id", row_number() OVER (PARTITION BY "tender_id", "product_id" ORDER BY "id"::text) AS rn
	FROM "tender_products"
) d
WHERE t."id" = d."id" AND d.rn > 1;--> statement-breakpoint
CREATE UNIQUE INDEX "products_name_lower_unique" ON "products" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_email_lower_unique" ON "profiles" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "tender_products_tender_product_unique" ON "tender_products" USING btree ("tender_id","product_id");