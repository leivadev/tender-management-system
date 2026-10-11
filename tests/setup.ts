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
	return realFetch(input, init);
}) as typeof fetch;
