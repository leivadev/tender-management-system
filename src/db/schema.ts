import { relations } from "drizzle-orm";
import { type AnyPgColumn, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const roleEnum = ["admin", "user", "viewer"] as const;

export const tenderStatusEnum = [
	"draft",
	"active",
	"finalized",
	"for_collection",
	"collected",
	"lost",
] as const;

export const profiles = pgTable("profiles", {
	id: uuid("id").primaryKey(), // references auth.users.id
	email: text("email").notNull(),
	role: text("role", { enum: roleEnum }).notNull().default("user"),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	// Nullable: the first bootstrap admin has no creator.
	createdBy: uuid("created_by").references((): AnyPgColumn => profiles.id),
}).enableRLS();

export const clients = pgTable("clients", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: text("name").notNull(),
	companyName: text("company_name").notNull(),
	email: text("email").notNull(),

	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	createdBy: uuid("created_by").references(() => profiles.id),
	updatedBy: uuid("updated_by").references(() => profiles.id),
}).enableRLS();

export const products = pgTable("products", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: text("name").notNull(),
	description: text("description"),
	unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),

	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	createdBy: uuid("created_by").references(() => profiles.id),
	updatedBy: uuid("updated_by").references(() => profiles.id),
}).enableRLS();

export const tenders = pgTable("tenders", {
	id: uuid("id").primaryKey().defaultRandom(),
	clientId: uuid("client_id")
		.notNull()
		.references(() => clients.id),

	title: text("title").notNull(),
	description: text("description"),

	maxBudget: numeric("max_budget", { precision: 12, scale: 2 }).notNull(),
	deadline: timestamp("deadline", { withTimezone: true }).notNull(),
	status: text("status", { enum: tenderStatusEnum }).notNull().default("draft"),

	proposalKey: text("proposal_key"),
	proposalUrl: text("proposal_url"),
	proposalFilename: text("proposal_filename"),
	proposalContentType: text("proposal_content_type"),

	invoiceAmount: numeric("invoice_amount", { precision: 12, scale: 2 }),
	reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),

	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	createdBy: uuid("created_by").references(() => profiles.id),
	updatedBy: uuid("updated_by").references(() => profiles.id),
}).enableRLS();

export const tenderProducts = pgTable("tender_products", {
	id: uuid("id").primaryKey().defaultRandom(),
	tenderId: uuid("tender_id")
		.notNull()
		.references(() => tenders.id),
	productId: uuid("product_id")
		.notNull()
		.references(() => products.id),

	quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
	unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
	subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),

	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	createdBy: uuid("created_by").references(() => profiles.id),
	updatedBy: uuid("updated_by").references(() => profiles.id),
}).enableRLS();

export const payments = pgTable("payments", {
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
}).enableRLS();

export const tenderStatusHistory = pgTable("tender_status_history", {
	id: uuid("id").primaryKey().defaultRandom(),
	tenderId: uuid("tender_id")
		.notNull()
		.references(() => tenders.id),

	fromStatus: text("from_status", { enum: tenderStatusEnum }),
	toStatus: text("to_status", { enum: tenderStatusEnum }).notNull(),

	changedBy: uuid("changed_by").references(() => profiles.id),
	changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

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
