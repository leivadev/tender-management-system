import { env } from "cloudflare:workers";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { api, futureDate, login, postJson, uniqueName, worker } from "./helpers";

let admin: string;
let tenderId: string;

const SECRET_EMAIL = "private.person@example.org";
const SECRET_TOKEN = "sbp_0123456789abcdef";

beforeAll(async () => {
	admin = await login("admin@example.com", "AdminPass123!");
	const client = await postJson(
		"/api/clients",
		{ name: "Client Correlation", companyName: "Acme", email: "delivered@resend.dev" },
		admin,
	);
	const tender = await postJson(
		"/api/tenders",
		{
			clientId: client.body.client.id,
			title: uniqueName("Correlation Fixture"),
			maxBudget: 1000,
			deadline: futureDate(),
		},
		admin,
	);
	tenderId = tender.body.tender.id;
});

afterEach(() => {
	vi.restoreAllMocks();
});

// Makes the proposal upload fail with an error whose message carries personal data and a secret.
function breakStorage() {
	const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
	vi.spyOn(env.PROPOSALS_R2, "put").mockRejectedValue(
		new Error(`write failed for ${SECRET_EMAIL} with token ${SECRET_TOKEN}`),
	);
	return errorLog;
}

async function failingUpload() {
	const pdf = new TextEncoder().encode("%PDF-1.4\n%%EOF");
	const form = new FormData();
	form.append("file", new Blob([pdf], { type: "application/pdf" }), "proposal.pdf");
	const res = await worker.fetch(`http://localhost/api/tenders/${tenderId}/proposal`, {
		method: "POST",
		headers: { Authorization: `Bearer ${admin}` },
		body: form,
	});
	return { res, body: (await res.json()) as any };
}

describe("error correlation (NFR-27)", () => {
	it("returns the same correlation id in the body, the header and the log of an unexpected error", async () => {
		const errorLog = breakStorage();

		const { res, body } = await failingUpload();

		expect(res.status).toBe(500);
		expect(body.error.code).toBe("INTERNAL_ERROR");
		expect(body.error.correlation_id).toMatch(/^[0-9a-f-]{36}$/);
		expect(res.headers.get("X-Correlation-Id")).toBe(body.error.correlation_id);
		expect(errorLog).toHaveBeenCalledTimes(1);
		const entry = JSON.parse(errorLog.mock.calls[0][0] as string);
		expect(entry.correlation_id).toBe(body.error.correlation_id);
		expect(entry.method).toBe("POST");
		expect(entry.path).toBe(`/api/tenders/${tenderId}/proposal`);
	});

	it("gives each failure its own id", async () => {
		breakStorage();

		const first = await failingUpload();
		const second = await failingUpload();

		expect(first.body.error.correlation_id).not.toBe(second.body.error.correlation_id);
	});

	it("does not add a correlation id to expected errors", async () => {
		const r = await api("/api/tenders/00000000-0000-0000-0000-000000000000", {}, admin);

		expect(r.status).toBe(404);
		expect(r.body.error.correlation_id).toBeUndefined();
	});
});

describe("log hygiene (NFR-19, NFR-20, SEC-07)", () => {
	it("keeps emails and tokens out of the logged error", async () => {
		const errorLog = breakStorage();

		await failingUpload();

		const logged = JSON.stringify(errorLog.mock.calls);
		expect(logged).not.toContain(SECRET_EMAIL);
		expect(logged).not.toContain(SECRET_TOKEN);
		expect(logged).not.toContain("Bearer");
		expect(logged).not.toContain(admin);
	});

	it("logs the database error code but not the offending values", async () => {
		const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
		const email = `dup.${crypto.randomUUID().slice(0, 8)}@example.org`;
		vi.spyOn(env.PROPOSALS_R2, "put").mockRejectedValue(
			Object.assign(new Error(`Failed query: insert ... params: ${email}`), {
				cause: Object.assign(new Error(`Key (email)=(${email}) is invalid`), { code: "22P02" }),
			}),
		);

		await failingUpload();

		const logged = JSON.stringify(errorLog.mock.calls);
		expect(logged).toContain("22P02");
		expect(logged).not.toContain(email);
	});
});

describe("error contract (section 3.1.4)", () => {
	it.each([
		["/api/tenders/not-a-uuid", 400, "VALIDATION_ERROR"],
		["/api/tenders/00000000-0000-0000-0000-000000000000", 404, "NOT_FOUND"],
		["/api/unknown", 404, "NOT_FOUND"],
	])("GET %s -> %i %s", async (path, status, code) => {
		const r = await api(path, {}, admin);

		expect(r.status).toBe(status);
		expect(r.body.error.code).toBe(code);
	});

	it("401 UNAUTHENTICATED without a session", async () => {
		const r = await api("/api/tenders");

		expect(r.status).toBe(401);
		expect(r.body.error.code).toBe("UNAUTHENTICATED");
	});
});
