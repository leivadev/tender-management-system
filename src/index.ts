import { fromHono } from "chanfana";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { Login } from "./endpoints/auth/login";
import { Logout } from "./endpoints/auth/logout";
import { Me } from "./endpoints/auth/me";
import { ClientArchive } from "./endpoints/clients/clientArchive";
import { ClientCreate } from "./endpoints/clients/clientCreate";
import { ClientList } from "./endpoints/clients/clientList";
import { ClientRestore } from "./endpoints/clients/clientRestore";
import { ClientUpdate } from "./endpoints/clients/clientUpdate";
import { DashboardMetrics } from "./endpoints/dashboard/dashboardMetrics";
import { DashboardSummary } from "./endpoints/dashboard/dashboardSummary";
import { ProductCreate } from "./endpoints/products/productCreate";
import { ProductList } from "./endpoints/products/productList";
import { ProductUpdate } from "./endpoints/products/productUpdate";
import { PaymentCreate } from "./endpoints/tenders/paymentCreate";
import { PaymentList } from "./endpoints/tenders/paymentList";
import { TenderAddProduct } from "./endpoints/tenders/tenderAddProduct";
import { TenderArchive } from "./endpoints/tenders/tenderArchive";
import { TenderCreate } from "./endpoints/tenders/tenderCreate";
import { TenderDetail } from "./endpoints/tenders/tenderDetail";
import { TenderDownloadProposal } from "./endpoints/tenders/tenderDownloadProposal";
import { TenderFinalize } from "./endpoints/tenders/tenderFinalize";
import { TenderHistory } from "./endpoints/tenders/tenderHistory";
import { TenderInvoice } from "./endpoints/tenders/tenderInvoice";
import { TenderInvoiceCorrect } from "./endpoints/tenders/tenderInvoiceCorrect";
import { TenderList } from "./endpoints/tenders/tenderList";
import { TenderLost } from "./endpoints/tenders/tenderLost";
import { TenderRemoveProduct } from "./endpoints/tenders/tenderRemoveProduct";
import { TenderRestore } from "./endpoints/tenders/tenderRestore";
import { TenderSend } from "./endpoints/tenders/tenderSend";
import { TenderUpdate } from "./endpoints/tenders/tenderUpdate";
import { TenderUploadProposal } from "./endpoints/tenders/tenderUploadProposal";
import { UserArchive } from "./endpoints/users/userArchive";
import { UserCreate } from "./endpoints/users/userCreate";
import { UserList } from "./endpoints/users/userList";
import { UserRestore } from "./endpoints/users/userRestore";
import { UserUpdate } from "./endpoints/users/userUpdate";
import { processExpiredTenders, processTenderReminders } from "./jobs/tenders";
import { AppError, type ErrorCode, errorBody } from "./lib/errors";
import { logUnexpectedError } from "./lib/logging";
import { type AppBindings, loadProfile, supabaseAuth } from "./middleware/auth";
import { blockViewerWrites, requireRole } from "./middleware/roles";
import type { AppContext } from "./types";

const app = new Hono<AppBindings>();

const CODE_BY_STATUS: Record<number, ErrorCode> = {
	400: "VALIDATION_ERROR",
	401: "UNAUTHENTICATED",
	403: "FORBIDDEN",
	404: "NOT_FOUND",
	409: "CONFLICT",
	429: "RATE_LIMITED",
};

type FieldIssue = { field: string; message: string };

// chanfana reports Zod failures as an HTTPException wrapping `{ errors: [{ message, path }] }`.
async function validationIssues(err: HTTPException): Promise<FieldIssue[]> {
	try {
		const body = (await err.getResponse().clone().json()) as {
			errors?: Array<{ message: string; path?: string[] }>;
		};
		return (body.errors ?? []).map((e) => ({
			field: (e.path ?? []).filter((p) => p !== "body" && p !== "query").join("."),
			message: e.message,
		}));
	} catch {
		return [];
	}
}

function issuesMessage(issues: FieldIssue[]): string | null {
	if (!issues.length) return null;
	return issues.map((i) => (i.field ? `${i.field}: ${i.message}` : i.message)).join("; ");
}

function internalErrorResponse(err: unknown, c: AppContext) {
	const correlationId = logUnexpectedError(err, { method: c.req.method, path: c.req.path });
	c.header("X-Correlation-Id", correlationId);
	return c.json(
		{ error: { code: "INTERNAL_ERROR", message: "Unexpected error.", correlation_id: correlationId } },
		500,
	);
}

app.onError(async (err, c) => {
	if (err instanceof AppError) {
		return c.json(errorBody(err), err.status as 400);
	}
	// withSupabase (@supabase/server) and chanfana throw a plain Hono HTTPException
	// instead of our AppError type.
	if (err instanceof HTTPException) {
		const code = CODE_BY_STATUS[err.status];
		// Section 3.1.4: a status outside the contract is an unexpected failure, not a new code.
		if (!code) return internalErrorResponse(err, c);
		const issues = err.message ? [] : await validationIssues(err);
		const message = err.message || issuesMessage(issues) || "Request failed.";
		// UI-02: per-field detail so the SPA can show each message next to its input.
		const fields = issues.filter((i) => i.field);
		return c.json({ error: { code, message, ...(fields.length && { fields }) } }, err.status);
	}
	return internalErrorResponse(err, c);
});

// FR-45: the spec needs a session. Hono runs handlers in registration order, so this must be
// registered before `fromHono` adds the `/openapi.json` route.
// chanfana also serves a YAML twin of the spec.
for (const path of ["/openapi.json", "/openapi.yaml"]) {
	app.use(path, supabaseAuth());
	app.use(path, loadProfile());
}

// FR-45: the API serves no documentation pages (`docs_url`/`redoc_url` null). The spec lives at
// `/openapi.json` behind the same session check as `/api/*`; Swagger UI is the SPA route `/docs` (FR-32).
const openapi = fromHono(app, {
	docs_url: null,
	redoc_url: null,
	openapi_url: "/openapi.json",
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
app.on("POST", "/api/users/:id/archive", adminOnly);
app.on("POST", "/api/users/:id/restore", adminOnly);
app.on("POST", "/api/products", adminOnly);
app.on("PATCH", "/api/products/:id", adminOnly);
app.on("POST", "/api/clients/:id/archive", adminOnly);
app.on("POST", "/api/clients/:id/restore", adminOnly);
app.on("POST", "/api/tenders/:id/archive", adminOnly);
app.on("POST", "/api/tenders/:id/restore", adminOnly);
app.on("POST", "/api/tenders/:id/invoice", adminOnly);
app.on("PATCH", "/api/tenders/:id/invoice", adminOnly);
app.on("POST", "/api/tenders/:id/payments", adminOnly);
app.on("POST", "/api/tenders/:id/lost", adminOnly);

openapi.get("/api/users", UserList);
openapi.post("/api/users", UserCreate);
openapi.patch("/api/users/:id", UserUpdate);
openapi.post("/api/users/:id/archive", UserArchive);
openapi.post("/api/users/:id/restore", UserRestore);

openapi.get("/api/dashboard", DashboardSummary);
openapi.get("/api/dashboard/metrics", DashboardMetrics);

openapi.get("/api/clients", ClientList);
openapi.post("/api/clients", ClientCreate);
openapi.patch("/api/clients/:id", ClientUpdate);
openapi.post("/api/clients/:id/archive", ClientArchive);
openapi.post("/api/clients/:id/restore", ClientRestore);

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
openapi.post("/api/tenders/:id/archive", TenderArchive);
openapi.post("/api/tenders/:id/restore", TenderRestore);
openapi.post("/api/tenders/:id/send", TenderSend);
openapi.post("/api/tenders/:id/finalize", TenderFinalize);
openapi.post("/api/tenders/:id/lost", TenderLost);
openapi.post("/api/tenders/:id/invoice", TenderInvoice);
openapi.patch("/api/tenders/:id/invoice", TenderInvoiceCorrect);
openapi.get("/api/tenders/:id/history", TenderHistory);
openapi.post("/api/tenders/:id/payments", PaymentCreate);
openapi.get("/api/tenders/:id/payments", PaymentList);

// Unknown API paths (e.g. the retired `/api/docs`) are a 404, never the SPA shell.
app.all("/api/*", () => {
	throw new AppError("NOT_FOUND", "Route not found.");
});

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
