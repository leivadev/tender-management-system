import { relations, sql } from "drizzle-orm";
import {
	type AnyPgColumn,
	boolean,
	check,
	index,
	integer,
	numeric,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { MAX_LENGTH } from "../lib/limits";

export const roleEnum = ["admin", "user", "viewer"] as const;

export const tenderStatusEnum = [
	"draft",
	"active",
	"finalized",
	"for_collection",
	"collected",
	"lost",
] as const;

export const tenderStatusPgEnum = pgEnum("tender_status", tenderStatusEnum);

// Text length limits (DAT-12) come from src/lib/limits.ts, shared with the API validation.
const maxLength = (column: AnyPgColumn, max: number) =>
	sql`char_length(${column}) <= ${sql.raw(String(max))}`;

export const profiles = pgTable(
	"profiles",
	{
		id: uuid("id").primaryKey(), // references auth.users.id
		email: text("email").notNull(),
		role: text("role", { enum: roleEnum }).notNull().default("user"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
		// Nullable: the first bootstrap admin has no creator.
		createdBy: uuid("created_by").references((): AnyPgColumn => profiles.id),
		updatedBy: uuid("updated_by").references((): AnyPgColumn => profiles.id),

		// DAT-11: archive marker and who set it; restoring clears both.
		archivedAt: timestamp("archived_at", { withTimezone: true }),
		archivedBy: uuid("archived_by").references((): AnyPgColumn => profiles.id),
	},
	(t) => [
		uniqueIndex("profiles_email_lower_unique").on(sql`lower(${t.email})`),
		check("profiles_email_length", maxLength(t.email, MAX_LENGTH.email)),
	],
).enableRLS();

export const clients = pgTable(
	"clients",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		name: text("name").notNull(),
		companyName: text("company_name").notNull(),
		email: text("email").notNull(),

		// DAT-11: archive marker and who set it; restoring clears both.
		archivedAt: timestamp("archived_at", { withTimezone: true }),
		archivedBy: uuid("archived_by").references(() => profiles.id),

		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
		createdBy: uuid("created_by").references(() => profiles.id),
		updatedBy: uuid("updated_by").references(() => profiles.id),
	},
	(t) => [
		check("clients_name_length", maxLength(t.name, MAX_LENGTH.contactName)),
		check("clients_company_name_length", maxLength(t.companyName, MAX_LENGTH.companyName)),
		check("clients_email_length", maxLength(t.email, MAX_LENGTH.email)),
	],
).enableRLS();

export const products = pgTable(
	"products",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		name: text("name").notNull(),
		description: text("description"),
		unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
		active: boolean("active").notNull().default(true),

		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
		createdBy: uuid("created_by").references(() => profiles.id),
		updatedBy: uuid("updated_by").references(() => profiles.id),
	},
	(t) => [
		uniqueIndex("products_name_lower_unique").on(sql`lower(${t.name})`),
		check("products_unit_price_positive", sql`${t.unitPrice} > 0`),
		check("products_name_length", maxLength(t.name, MAX_LENGTH.productName)),
		check("products_description_length", maxLength(t.description, MAX_LENGTH.productDescription)),
	],
).enableRLS();

export const tenders = pgTable(
	"tenders",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		clientId: uuid("client_id")
			.notNull()
			.references(() => clients.id),

		title: text("title").notNull(),
		description: text("description"),

		maxBudget: numeric("max_budget", { precision: 12, scale: 2 }).notNull(),
		deadline: timestamp("deadline", { withTimezone: true }).notNull(),
		status: tenderStatusPgEnum("status").notNull().default("draft"),

		proposalKey: text("proposal_key"),
		proposalUrl: text("proposal_url"),
		proposalFilename: text("proposal_filename"),
		proposalContentType: text("proposal_content_type"),

		invoiceAmount: numeric("invoice_amount", { precision: 12, scale: 2 }),
		reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),

		// DAT-11: archive marker and who set it; restoring clears both. Status and history are untouched.
		archivedAt: timestamp("archived_at", { withTimezone: true }),
		archivedBy: uuid("archived_by").references(() => profiles.id),

		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
		createdBy: uuid("created_by").references(() => profiles.id),
		updatedBy: uuid("updated_by").references(() => profiles.id),
	},
	(t) => [
		index("tenders_status_idx").on(t.status),
		index("tenders_deadline_idx").on(t.deadline),
		index("tenders_client_id_idx").on(t.clientId),
		check("tenders_max_budget_positive", sql`${t.maxBudget} > 0`),
		check("tenders_invoice_amount_positive", sql`${t.invoiceAmount} is null or ${t.invoiceAmount} > 0`),
		check("tenders_title_length", maxLength(t.title, MAX_LENGTH.tenderTitle)),
		check("tenders_description_length", maxLength(t.description, MAX_LENGTH.tenderDescription)),
	],
).enableRLS();

export const tenderProducts = pgTable(
	"tender_products",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		tenderId: uuid("tender_id")
			.notNull()
			.references(() => tenders.id),
		productId: uuid("product_id")
			.notNull()
			.references(() => products.id),

		quantity: integer("quantity").notNull(),
		unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
		subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),

		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
		createdBy: uuid("created_by").references(() => profiles.id),
		updatedBy: uuid("updated_by").references(() => profiles.id),
	},
	(t) => [
		uniqueIndex("tender_products_tender_product_unique").on(t.tenderId, t.productId),
		index("tender_products_product_id_idx").on(t.productId),
		check("tender_products_quantity_min", sql`${t.quantity} >= 1`),
		check("tender_products_unit_price_positive", sql`${t.unitPrice} > 0`),
	],
).enableRLS();

export const payments = pgTable(
	"payments",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		tenderId: uuid("tender_id")
			.notNull()
			.references(() => tenders.id),

		amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
		paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
		reference: text("reference"),
		notes: text("notes"),

		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		createdBy: uuid("created_by").references(() => profiles.id),
	},
	(t) => [
		index("payments_tender_id_idx").on(t.tenderId),
		check("payments_amount_positive", sql`${t.amount} > 0`),
		check("payments_reference_length", maxLength(t.reference, MAX_LENGTH.paymentReference)),
		check("payments_notes_length", maxLength(t.notes, MAX_LENGTH.paymentNote)),
	],
).enableRLS();

export const tenderStatusHistory = pgTable(
	"tender_status_history",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		tenderId: uuid("tender_id")
			.notNull()
			.references(() => tenders.id),

		fromStatus: tenderStatusPgEnum("from_status"),
		toStatus: tenderStatusPgEnum("to_status").notNull(),

		changedBy: uuid("changed_by").references(() => profiles.id),
		changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index("tender_status_history_tender_id_idx").on(t.tenderId)],
).enableRLS();

export const clientsRelations = relations(clients, ({ many }) => ({
	tenders: many(tenders),
}));

export const tendersRelations = relations(tenders, ({ one, many }) => ({
	client: one(clients, {
		fields: [tenders.clientId],
		references: [clients.id],
	}),
	tenderProducts: many(tenderProducts),
	payments: many(payments),
	statusHistory: many(tenderStatusHistory),
}));

export const tenderProductsRelations = relations(tenderProducts, ({ one }) => ({
	tender: one(tenders, {
		fields: [tenderProducts.tenderId],
		references: [tenders.id],
	}),
	product: one(products, {
		fields: [tenderProducts.productId],
		references: [products.id],
	}),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
	tender: one(tenders, {
		fields: [payments.tenderId],
		references: [tenders.id],
	}),
}));

export const tenderStatusHistoryRelations = relations(tenderStatusHistory, ({ one }) => ({
	tender: one(tenders, {
		fields: [tenderStatusHistory.tenderId],
		references: [tenders.id],
	}),
}));
