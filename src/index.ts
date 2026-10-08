import { fromHono } from "chanfana";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { Login } from "./endpoints/auth/login";
import { Logout } from "./endpoints/auth/logout";
import { Me } from "./endpoints/auth/me";
import { ClientCreate } from "./endpoints/clients/clientCreate";
import { ClientList } from "./endpoints/clients/clientList";
import { ClientUpdate } from "./endpoints/clients/clientUpdate";
import { DashboardSummary } from "./endpoints/dashboard/dashboardSummary";
import { ProductCreate } from "./endpoints/products/productCreate";
import { ProductList } from "./endpoints/products/productList";
import { ProductUpdate } from "./endpoints/products/productUpdate";
import { PaymentCreate } from "./endpoints/tenders/paymentCreate";
import { PaymentList } from "./endpoints/tenders/paymentList";
import { TenderAddProduct } from "./endpoints/tenders/tenderAddProduct";
import { TenderCreate } from "./endpoints/tenders/tenderCreate";
import { TenderDetail } from "./endpoints/tenders/tenderDetail";
import { TenderDownloadProposal } from "./endpoints/tenders/tenderDownloadProposal";
import { TenderFinalize } from "./endpoints/tenders/tenderFinalize";
import { TenderHistory } from "./endpoints/tenders/tenderHistory";
import { TenderInvoice } from "./endpoints/tenders/tenderInvoice";
import { TenderList } from "./endpoints/tenders/tenderList";
import { TenderLost } from "./endpoints/tenders/tenderLost";
import { TenderRemoveProduct } from "./endpoints/tenders/tenderRemoveProduct";
import { TenderSend } from "./endpoints/tenders/tenderSend";
import { TenderUpdate } from "./endpoints/tenders/tenderUpdate";
import { TenderUploadProposal } from "./endpoints/tenders/tenderUploadProposal";
import { UserCreate } from "./endpoints/users/userCreate";
import { UserList } from "./endpoints/users/userList";
import { UserUpdate } from "./endpoints/users/userUpdate";
import { processExpiredTenders, processTenderReminders } from "./jobs/tenders";
import { AppError, type ErrorCode, errorBody } from "./lib/errors";
import { type AppBindings, loadProfile, supabaseAuth } from "./middleware/auth";
import { blockViewerWrites, requireRole } from "./middleware/roles";

const app = new Hono<AppBindings>();

const CODE_BY_STATUS: Record<number, ErrorCode> = {
	400: "VALIDATION_ERROR",
	401: "UNAUTHENTICATED",
	403: "FORBIDDEN",
	404: "NOT_FOUND",
	409: "CONFLICT",
	429: "RATE_LIMITED",
};

// chanfana reports Zod failures as an HTTPException wrapping `{ errors: [{ message, path }] }`.
async function validationMessage(err: HTTPException): Promise<string | null> {
	try {
		const body = (await err.getResponse().clone().json()) as {
			errors?: Array<{ message: string; path?: string[] }>;
		};
		if (!body.errors?.length) return null;
		return body.errors
			.map((e) => {
				const field = (e.path ?? []).filter((p) => p !== "body" && p !== "query").join(".");
				return field ? `${field}: ${e.message}` : e.message;
			})
			.join("; ");
	} catch {
		return null;
	}
}

app.onError(async (err, c) => {
	if (err instanceof AppError) {
		return c.json(errorBody(err), err.status as 400);
	}
	// withSupabase (@supabase/server) and chanfana throw a plain Hono HTTPException
	// instead of our AppError type.
	if (err instanceof HTTPException) {
		const code = CODE_BY_STATUS[err.status] ?? "INTERNAL_ERROR";
		const message = err.message || (await validationMessage(err)) || "Request failed.";
		return c.json({ error: { code, message } }, err.status);
	}
	console.error(err);
	return c.json({ error: { code: "INTERNAL_ERROR", message: "Unexpected error." } }, 500);
});

const openapi = fromHono(app, {
	docs_url: "/api/docs",
	schema: {
		security: [{ bearerAuth: [] }],
	},
});

openapi.registry.registerComponent("securitySchemes", "bearerAuth", {
	type: "http",
	scheme: "bearer",
	bearerFormat: "JWT",
});

// Public
openapi.post("/api/auth/login", Login);

// Everything else under /api requires a valid Supabase session + profile.
app.use("/api/*", async (c, next) => {
	if (c.req.path === "/api/auth/login") return next();
	return supabaseAuth()(c, next);
});
app.use("/api/*", async (c, next) => {
	if (c.req.path === "/api/auth/login") return next();
	return loadProfile()(c, next);
});

app.use("/api/*", async (c, next) => {
	if (c.req.path === "/api/auth/login") return next();
	return blockViewerWrites()(c, next);
});

openapi.post("/api/auth/logout", Logout);
openapi.get("/api/auth/me", Me);

const adminOnly = requireRole("admin");
app.use("/api/users", adminOnly);
app.use("/api/users/:id", adminOnly);
app.on("POST", "/api/products", adminOnly);
app.on("PATCH", "/api/products/:id", adminOnly);
app.on("POST", "/api/tenders/:id/invoice", adminOnly);
app.on("POST", "/api/tenders/:id/payments", adminOnly);
app.on("POST", "/api/tenders/:id/lost", adminOnly);

openapi.get("/api/users", UserList);
openapi.post("/api/users", UserCreate);
openapi.patch("/api/users/:id", UserUpdate);

openapi.get("/api/dashboard", DashboardSummary);

openapi.get("/api/clients", ClientList);
openapi.post("/api/clients", ClientCreate);
openapi.patch("/api/clients/:id", ClientUpdate);

openapi.get("/api/products", ProductList);
openapi.post("/api/products", ProductCreate);
openapi.patch("/api/products/:id", ProductUpdate);

openapi.get("/api/tenders", TenderList);
openapi.post("/api/tenders", TenderCreate);
openapi.get("/api/tenders/:id", TenderDetail);
openapi.patch("/api/tenders/:id", TenderUpdate);
openapi.post("/api/tenders/:id/products", TenderAddProduct);
openapi.delete("/api/tenders/:id/products/:productId", TenderRemoveProduct);
openapi.post("/api/tenders/:id/proposal", TenderUploadProposal);
openapi.get("/api/tenders/:id/proposal/download", TenderDownloadProposal);
openapi.post("/api/tenders/:id/send", TenderSend);
openapi.post("/api/tenders/:id/finalize", TenderFinalize);
openapi.post("/api/tenders/:id/lost", TenderLost);
openapi.post("/api/tenders/:id/invoice", TenderInvoice);
openapi.get("/api/tenders/:id/history", TenderHistory);
openapi.post("/api/tenders/:id/payments", PaymentCreate);
openapi.get("/api/tenders/:id/payments", PaymentList);

app.get("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default {
	fetch: app.fetch,
	async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
		ctx.waitUntil(
			(async () => {
				await processExpiredTenders(env);
				await processTenderReminders(env);
			})(),
		);
	},
};
