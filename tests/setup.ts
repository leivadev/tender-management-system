const realFetch = globalThis.fetch;

export type SentEmail = {
	from: string;
	to: string[];
	subject: string;
	html: string;
	text: string;
	reply_to?: unknown;
	attachments?: Array<{ filename: string; content: string }>;
};

// Resend payloads captured by the stub, so tests can assert on email content.
export const sentEmails: SentEmail[] = [];
(globalThis as { __sentEmails?: typeof sentEmails }).__sentEmails = sentEmails;

// Tests flip this to make the stub behave like a failing email provider.
export const resendStub = { fail: false, network: false, hang: false };
(globalThis as { __resendStub?: typeof resendStub }).__resendStub = resendStub;

// Local Supabase does not throttle password sign-ins, so tests flip these to simulate the hosted provider.
// `authRequests` records what the Worker sends to the provider (FR-06: end-user IP forwarding).
export const authStub = { rateLimit: false, logoutFails: false };
export const authRequests: Array<{ path: string; headers: Record<string, string> }> = [];
(globalThis as { __authStub?: typeof authStub }).__authStub = authStub;
(globalThis as { __authRequests?: typeof authRequests }).__authRequests = authRequests;

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
	const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
	if (url.startsWith("https://api.resend.com/")) {
		if (resendStub.network) throw new TypeError("fetch failed");
		if (resendStub.hang) return new Promise<Response>(() => {});
		if (resendStub.fail) {
			return Response.json(
				{ name: "validation_error", message: "Provider rejected the email.", statusCode: 422 },
				{ status: 422 },
			);
		}
		if (typeof init?.body === "string") sentEmails.push(JSON.parse(init.body));
		return Response.json({ id: "test-email-id" });
	}
	const authPath = new URL(url).pathname.match(/^\/auth\/v1\/(token|logout)$/)?.[0];
	if (authPath) {
		const headers = Object.fromEntries(
			new Headers(init?.headers ?? (input instanceof Request ? input.headers : {})),
		);
		authRequests.push({ path: authPath, headers });
		if (authPath.endsWith("/token") && authStub.rateLimit) {
			return Response.json(
				{ code: 429, error_code: "over_request_rate_limit", msg: "Request rate limit reached" },
				{ status: 429 },
			);
		}
		if (authPath.endsWith("/logout") && authStub.logoutFails) {
			return Response.json({ code: 500, msg: "Internal error" }, { status: 500 });
		}
	}
	return realFetch(input, init);
}) as typeof fetch;
