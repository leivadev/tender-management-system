import { env } from "cloudflare:workers";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { api, futureDate, login, postJson, uniqueName, uploadPdf, worker } from "./helpers";

let admin: string;
let clientId: string;
let productId: string;

const MB = 1024 * 1024;

beforeAll(async () => {
	admin = await login("admin@example.com", "AdminPass123!");
	const client = await postJson(
		"/api/clients",
		{ name: "Client Proposal", companyName: "Acme", email: "delivered@resend.dev" },
		admin,
	);
	clientId = client.body.client.id;
	const product = await postJson(
		"/api/products",
		{ name: uniqueName("Proposal Product"), unitPrice: 10 },
		admin,
	);
	productId = product.body.product.id;
});

afterEach(() => {
	vi.restoreAllMocks();
});

async function createTender() {
	const r = await postJson(
		"/api/tenders",
		{ clientId, title: "Proposal Fixture", maxBudget: 1000, deadline: futureDate() },
		admin,
	);
	expect(r.status).toBe(201);
	return r.body.tender.id as string;
}

async function upload(tenderId: string, bytes: BlobPart, type = "application/pdf", name = "proposal.pdf") {
	const form = new FormData();
	form.append("file", new Blob([bytes], { type }), name);
	const res = await worker.fetch(`http://localhost/api/tenders/${tenderId}/proposal`, {
		method: "POST",
		headers: { Authorization: `Bearer ${admin}` },
		body: form,
	});
	return { status: res.status, body: (await res.json()) as any };
}

const pdfOfSize = (size: number) => {
	const bytes = new Uint8Array(size);
	bytes.set(new TextEncoder().encode("%PDF-1.4\n"));
	return bytes;
};

async function proposalKey(tenderId: string) {
	return (await api(`/api/tenders/${tenderId}`, {}, admin)).body.tender.proposalKey as string | null;
}

async function toStatus(
	tenderId: string,
	target: "active" | "finalized" | "for_collection" | "collected" | "lost",
) {
	if (target === "lost") {
		await api(
			`/api/tenders/${tenderId}/products`,
			{
				method: "POST",
				body: JSON.stringify({ productId, quantity: 1 }),
			},
			admin,
		);
		await uploadPdf(tenderId, admin);
		expect((await postJson(`/api/tenders/${tenderId}/send`, {}, admin)).status).toBe(200);
		expect((await postJson(`/api/tenders/${tenderId}/lost`, {}, admin)).status).toBe(200);
		return;
	}
	await postJson(`/api/tenders/${tenderId}/products`, { productId, quantity: 1 }, admin);
	await uploadPdf(tenderId, admin);
	expect((await postJson(`/api/tenders/${tenderId}/send`, {}, admin)).status).toBe(200);
	if (target === "active") return;
	expect((await postJson(`/api/tenders/${tenderId}/finalize`, {}, admin)).status).toBe(200);
	if (target === "finalized") return;
	expect((await postJson(`/api/tenders/${tenderId}/invoice`, { invoiceAmount: 100 }, admin)).status).toBe(
		200,
	);
	if (target === "for_collection") return;
	expect((await postJson(`/api/tenders/${tenderId}/payments`, { amount: 100 }, admin)).status).toBe(201);
}

describe("proposal upload restricted to draft (FR-34, FR-35)", () => {
	it.each(["active", "finalized", "for_collection", "collected", "lost"] as const)(
		"upload and replace rejected in %s",
		async (status) => {
			const tenderId = await createTender();
			await toStatus(tenderId, status);
			const before = await proposalKey(tenderId);

			const r = await upload(tenderId, pdfOfSize(100));

			expect(r.status).toBe(422);
			expect(r.body.error.code).toBe("BUSINESS_RULE_VIOLATION");
			expect(await proposalKey(tenderId)).toBe(before);
		},
	);

	it("a rejected upload stores nothing in R2", async () => {
		const tenderId = await createTender();
		await toStatus(tenderId, "active");
		const before = (await env.PROPOSALS_R2.list({ prefix: `proposals/${tenderId}/` })).objects.length;

		await upload(tenderId, pdfOfSize(100));

		const after = (await env.PROPOSALS_R2.list({ prefix: `proposals/${tenderId}/` })).objects.length;
		expect(after).toBe(before);
	});
});

describe("proposal content validation (BR-04, SEC-11, BR-13)", () => {
	it("HTML declared as application/pdf is rejected (BR-04, SEC-11)", async () => {
		const tenderId = await createTender();
		const r = await upload(tenderId, "<html><script>alert(1)</script></html>", "application/pdf");
		expect(r.status).toBe(400);
		expect(r.body.error.code).toBe("VALIDATION_ERROR");
		expect(await proposalKey(tenderId)).toBeNull();
	});

	it("content must start with %PDF- (BR-04)", async () => {
		const tenderId = await createTender();
		const r = await upload(tenderId, "%PDF1.4 no dash");
		expect(r.status).toBe(400);
	});

	it("a real PDF is accepted even when declared with another type (BR-04)", async () => {
		const tenderId = await createTender();
		const r = await upload(tenderId, pdfOfSize(100), "application/octet-stream");
		expect(r.status).toBe(200);
		expect(r.body.tender.proposalContentType).toBe("application/pdf");
	});

	it("files over 15 MB are rejected (BR-13)", async () => {
		const tenderId = await createTender();
		const r = await upload(tenderId, pdfOfSize(15 * MB + 1));
		expect(r.status).toBe(400);
		expect(r.body.error.code).toBe("VALIDATION_ERROR");
		expect(await proposalKey(tenderId)).toBeNull();
	});

	it("a file of exactly 15 MB is accepted (BR-13)", async () => {
		const tenderId = await createTender();
		const r = await upload(tenderId, pdfOfSize(15 * MB));
		expect(r.status).toBe(200);
	});
});

describe("proposal replacement and cleanup (FR-54)", () => {
	it("replacing in draft stores the new object and deletes the old one", async () => {
		const tenderId = await createTender();
		const first = await upload(tenderId, pdfOfSize(100), "application/pdf", "first.pdf");
		const oldKey = first.body.tender.proposalKey as string;

		const second = await upload(tenderId, pdfOfSize(200), "application/pdf", "second.pdf");

		expect(second.status).toBe(200);
		const newKey = second.body.tender.proposalKey as string;
		expect(newKey).not.toBe(oldKey);
		expect(second.body.tender.proposalFilename).toBe("second.pdf");
		expect(await env.PROPOSALS_R2.head(oldKey)).toBeNull();
		expect(await env.PROPOSALS_R2.head(newKey)).not.toBeNull();
		const listed = await env.PROPOSALS_R2.list({ prefix: `proposals/${tenderId}/` });
		expect(listed.objects.map((o) => o.key)).toEqual([newKey]);
	});

	it("if deleting the old object fails the replace still succeeds and the failure is logged (FR-54)", async () => {
		const tenderId = await createTender();
		const first = await upload(tenderId, pdfOfSize(100));
		const oldKey = first.body.tender.proposalKey as string;
		const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
		const del = vi.spyOn(env.PROPOSALS_R2, "delete").mockRejectedValue(new Error("r2 down"));

		const second = await upload(tenderId, pdfOfSize(200));

		expect(second.status).toBe(200);
		expect(second.body.tender.proposalKey).not.toBe(oldKey);
		expect(del).toHaveBeenCalledWith(oldKey);
		expect(errorLog).toHaveBeenCalled();
		expect(JSON.stringify(errorLog.mock.calls)).toContain(oldKey);
		expect(await proposalKey(tenderId)).toBe(second.body.tender.proposalKey);
	});

	it("a rejected replacement keeps the current proposal untouched", async () => {
		const tenderId = await createTender();
		const first = await upload(tenderId, pdfOfSize(100));
		const key = first.body.tender.proposalKey as string;

		const bad = await upload(tenderId, "<html></html>");

		expect(bad.status).toBe(400);
		expect(await proposalKey(tenderId)).toBe(key);
		expect(await env.PROPOSALS_R2.head(key)).not.toBeNull();
	});
});

describe("proposal download and object names (FR-16, SEC-15, SEC-16, SEC-06)", () => {
	it("download without a session -> 401 (FR-16, SEC-16)", async () => {
		const tenderId = await createTender();
		await uploadPdf(tenderId, admin);
		const res = await worker.fetch(`http://localhost/api/tenders/${tenderId}/proposal/download`);
		expect(res.status).toBe(401);
	});

	it("the stored proposalUrl is the stable authenticated download URL (FR-16)", async () => {
		const tenderId = await createTender();
		const r = await upload(tenderId, pdfOfSize(100));
		expect(r.body.tender.proposalUrl).toMatch(new RegExp(`/api/tenders/${tenderId}/proposal/download$`));

		const res = await worker.fetch(`http://localhost/api/tenders/${tenderId}/proposal/download`, {
			headers: { Authorization: `Bearer ${admin}` },
		});
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toBe("application/pdf");
		expect((await res.text()).startsWith("%PDF-")).toBe(true);
	});

	it("object names carry a random UUID v4 (122 random bits) (SEC-15)", async () => {
		const tenderId = await createTender();
		const keys = new Set<string>();
		for (let i = 0; i < 3; i++) {
			const r = await upload(tenderId, pdfOfSize(100));
			keys.add(r.body.tender.proposalKey);
		}
		expect(keys.size).toBe(3);
		for (const key of keys) {
			expect(key).toMatch(
				new RegExp(
					`^proposals/${tenderId}/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.pdf$`,
				),
			);
		}
	});

	it("the bucket has no public access configured (SEC-06)", async () => {
		const config = await import("../wrangler.jsonc?raw").then((m) => m.default as string);
		const r2Block = config.slice(
			config.indexOf('"r2_buckets"'),
			config.indexOf("]", config.indexOf('"r2_buckets"')),
		);
		expect(r2Block).toContain("PROPOSALS_R2");
		expect(r2Block).not.toMatch(/r2\.dev|custom_domain|public/i);
	});
});
