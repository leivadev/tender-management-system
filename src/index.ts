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
import { AppError, errorBody } from "./lib/errors";
import { type AppBindings, loadProfile, supabaseAuth } from "./middleware/auth";
import { blockViewerWrites, requireRole } from "./middleware/roles";

const app = new Hono<AppBindings>();

app.onError((err, c) => {
	if (err instanceof AppError) {
		return c.json(errorBody(err), err.status as 400);
	}
	// withSupabase (@supabase/server) throws a plain Hono HTTPException on
	// missing/invalid Bearer tokens instead of our AppError type.
	if (err instanceof HTTPException) {
		const code = err.status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN";
		return c.json({ error: { code, message: err.message || "Unauthorized." } }, err.status);
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

openapi.get("/api/users", UserList);
app.use("/api/users", async (c, next) => {
	if (c.req.method !== "POST") return next();
	return requireRole("admin")(c, next);
});
openapi.post("/api/users", UserCreate);
app.use("/api/users/:id", requireRole("admin"));
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
